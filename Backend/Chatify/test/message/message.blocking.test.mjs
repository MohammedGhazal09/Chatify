import { describe, expect, it } from 'vitest';
import Message from '../../Models/messageModel.mjs';
import UserBlock from '../../Models/userBlockModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createMessage } from '../fixtures/messages.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const setupBlockedMessageScenario = async () => {
  await UserBlock.init();
  await Message.init();

  const memberOne = await signupWithAgent({ firstName: 'Message', lastName: 'Blocker' });
  const memberTwo = await signupWithAgent({ firstName: 'Message', lastName: 'Blocked' });
  const chat = await createDirectChat([memberOne.user, memberTwo.user]);
  const existingMessage = await createMessage({
    chat,
    sender: memberOne.user,
    text: 'Visible before block',
  });

  await memberOne.agent.post(`/api/chat/${chat._id}/block`).expect(200);

  return { memberOne, memberTwo, chat, existingMessage };
};

describe('HTTP message blocking contract', () => {
  it('rejects new messages from either side while preserving history reads', async () => {
    const { memberOne, memberTwo, chat, existingMessage } = await setupBlockedMessageScenario();

    const blockedPeerSend = await memberTwo.agent
      .post('/api/message/new-message')
      .send({
        chatId: chat._id.toString(),
        text: 'Should not persist',
        clientMessageId: 'blocked-peer-send',
      })
      .expect(403);

    expect(blockedPeerSend.body).toMatchObject({
      status: 'fail',
      code: 'conversation_blocked',
    });

    await memberOne.agent
      .post('/api/message/new-message')
      .send({
        chatId: chat._id.toString(),
        text: 'Blocker also cannot send',
        clientMessageId: 'blocker-send-after-block',
      })
      .expect(403);

    await expect(Message.countDocuments({ chatId: chat._id })).resolves.toBe(1);

    const history = await memberTwo.agent
      .get(`/api/message/get-all-messages/${chat._id}`)
      .expect(200);

    expect(history.body.data.messages.map((message) => message._id)).toContain(existingMessage._id.toString());
  });

  it('blocks read receipts and active mutations but allows delete-for-self', async () => {
    const { memberOne, memberTwo, existingMessage } = await setupBlockedMessageScenario();

    await memberTwo.agent
      .patch(`/api/message/${existingMessage._id}/read`)
      .expect(403);

    await memberTwo.agent
      .post(`/api/message/${existingMessage._id}/reaction`)
      .send({ emoji: 'ok' })
      .expect(403);

    await memberOne.agent
      .delete(`/api/message/${existingMessage._id}`)
      .send({ deleteForEveryone: true })
      .expect(403);

    await memberTwo.agent
      .delete(`/api/message/${existingMessage._id}`)
      .send({ deleteForEveryone: false })
      .expect(200);

    const storedMessage = await Message.findById(existingMessage._id);

    expect(storedMessage.deletedFor.map((userId) => userId.toString())).toContain(memberTwo.user._id.toString());
    expect(storedMessage.deletedForEveryone).toBe(false);
  });

  it('keeps unread state stable while blocked and restores read receipts after unblock', async () => {
    const { memberOne, memberTwo, chat, existingMessage } = await setupBlockedMessageScenario();

    const unreadBefore = await memberTwo.agent
      .get(`/api/message/${chat._id}/unread-count`)
      .expect(200);

    expect(unreadBefore.body.data.unreadCount).toBe(1);

    const singleReadResponse = await memberTwo.agent
      .patch(`/api/message/${existingMessage._id}/read`)
      .expect(403);

    expect(singleReadResponse.body).toMatchObject({
      status: 'fail',
      code: 'conversation_blocked',
    });

    const batchReadResponse = await memberTwo.agent
      .patch(`/api/message/${chat._id}/mark-read`)
      .send({ messageIds: [existingMessage._id.toString()] })
      .expect(403);

    expect(batchReadResponse.body).toMatchObject({
      status: 'fail',
      code: 'conversation_blocked',
    });

    const unreadAfterBlockedAttempts = await memberTwo.agent
      .get(`/api/message/${chat._id}/unread-count`)
      .expect(200);

    expect(unreadAfterBlockedAttempts.body.data.unreadCount).toBe(1);

    const blockedStoredMessage = await Message.findById(existingMessage._id);
    const blockedReadByUsers = blockedStoredMessage.readBy.map((entry) => entry.user.toString());

    expect(blockedStoredMessage.status).toBe('sent');
    expect(blockedReadByUsers).not.toContain(memberTwo.user._id.toString());

    await memberOne.agent
      .delete(`/api/chat/${chat._id}/block`)
      .expect(200);

    await memberTwo.agent
      .patch(`/api/message/${existingMessage._id}/read`)
      .expect(200);

    const unreadAfterUnblock = await memberTwo.agent
      .get(`/api/message/${chat._id}/unread-count`)
      .expect(200);

    const readStoredMessage = await Message.findById(existingMessage._id);
    const readByUsers = readStoredMessage.readBy.map((entry) => entry.user.toString());

    expect(unreadAfterUnblock.body.data.unreadCount).toBe(0);
    expect(readByUsers).toContain(memberTwo.user._id.toString());
    expect(readStoredMessage.status).toBe('read');
  });
});
