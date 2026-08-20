import { beforeEach, describe, expect, it, vi } from 'vitest';
import Chats from '../../Models/chatModel.mjs';
import Message from '../../Models/messageModel.mjs';
import Spaces from '../../Models/spaceModel.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

vi.mock('../../Config/socket.mjs', () => ({
  emitToUserSockets: vi.fn(),
  joinUserToChat: vi.fn(),
  removeUserFromChat: vi.fn(),
  getIO: vi.fn(() => ({
    in: vi.fn(() => ({
      emit: vi.fn(),
    })),
  })),
}));

const setupChannelMessaging = async () => {
  await Spaces.init();
  await Chats.init();
  await Message.init();

  const owner = await signupWithAgent({ firstName: 'Space', lastName: 'Owner' });
  const member = await signupWithAgent({ firstName: 'Space', lastName: 'Member' });
  const outsider = await signupWithAgent({ firstName: 'Space', lastName: 'Outsider' });
  const created = await owner.agent
    .post('/api/space')
    .send({
      name: 'Messaging Room',
      memberUsernames: [member.user.username],
    })
    .expect(201);

  return {
    owner,
    member,
    outsider,
    spaceId: created.body.data.space._id,
    channelId: created.body.data.channel._id,
  };
};

describe('space channel messaging contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets channel members use existing message, unread, read, and reaction APIs', async () => {
    const { owner, member, channelId } = await setupChannelMessaging();

    const createResponse = await owner.agent
      .post('/api/message/new-message')
      .send({
        chatId: channelId,
        text: 'Channel message contract',
        clientMessageId: 'space-channel-message-1',
      })
      .expect(201);
    const messageId = createResponse.body.data.message._id;

    const messagesResponse = await member.agent
      .get(`/api/message/get-all-messages/${channelId}`)
      .expect(200);
    const unreadResponse = await member.agent
      .get(`/api/message/${channelId}/unread-count`)
      .expect(200);
    const batchUnreadResponse = await member.agent
      .post('/api/message/batch/unread-counts')
      .send({ chatIds: [channelId] })
      .expect(200);

    expect(messagesResponse.body.data.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        _id: messageId,
        chatId: channelId,
        sender: owner.user._id.toString(),
        text: 'Channel message contract',
      }),
    ]));
    expect(unreadResponse.body.data.unreadCount).toBe(1);
    expect(batchUnreadResponse.body.data.counts[channelId]).toBe(1);

    const reactionResponse = await member.agent
      .post(`/api/message/${messageId}/reaction`)
      .send({ emoji: 'ok' })
      .expect(200);
    const readResponse = await member.agent
      .patch(`/api/message/${messageId}/read`)
      .expect(200);
    const unreadAfterRead = await member.agent
      .get(`/api/message/${channelId}/unread-count`)
      .expect(200);

    expect(reactionResponse.body.data).toMatchObject({
      messageId,
      action: 'added',
      reactions: [expect.objectContaining({
        user: member.user._id.toString(),
        emoji: 'ok',
      })],
    });
    expect(readResponse.body.data.unreadCount).toBe(0);
    expect(unreadAfterRead.body.data.unreadCount).toBe(0);
  });

  it('keeps non-members and removed members out of channel message surfaces', async () => {
    const { owner, member, outsider, spaceId, channelId } = await setupChannelMessaging();
    const createResponse = await owner.agent
      .post('/api/message/new-message')
      .send({
        chatId: channelId,
        text: 'Private channel marker',
        clientMessageId: 'space-channel-message-2',
      })
      .expect(201);
    const messageId = createResponse.body.data.message._id;

    await outsider.agent
      .get(`/api/message/get-all-messages/${channelId}`)
      .expect(403);
    await outsider.agent
      .get(`/api/message/${channelId}/unread-count`)
      .expect(403);
    await outsider.agent
      .get(`/api/message/${channelId}/shared-assets`)
      .expect(403);
    const outsiderBatch = await outsider.agent
      .post('/api/message/batch/unread-counts')
      .send({ chatIds: [channelId] })
      .expect(200);
    await outsider.agent
      .post(`/api/message/${messageId}/reaction`)
      .send({ emoji: 'ok' })
      .expect(403);

    expect(outsiderBatch.body.data.counts).not.toHaveProperty(channelId);

    await owner.agent
      .delete(`/api/space/${spaceId}/members/${member.user._id}`)
      .expect(200);

    await member.agent
      .get(`/api/message/get-all-messages/${channelId}`)
      .expect(403);
    await member.agent
      .get(`/api/message/${channelId}/unread-count`)
      .expect(403);
    await member.agent
      .post(`/api/message/${messageId}/reaction`)
      .send({ emoji: 'ok' })
      .expect(403);
    await member.agent
      .patch(`/api/message/${messageId}/read`)
      .expect(403);
  });
});
