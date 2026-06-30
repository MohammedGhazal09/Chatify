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

const setupGroupMentionScenario = async (options = {}) => {
  await Chats.init();
  await Message.init();

  const owner = await signupWithAgent({ firstName: 'Mention', lastName: 'Owner' });
  const memberTwo = await signupWithAgent({ firstName: 'Mention', lastName: 'Two' });
  const memberThree = await signupWithAgent({ firstName: 'Mention', lastName: 'Three' });
  const outsider = await signupWithAgent({ firstName: 'Mention', lastName: 'Outsider' });

  const groupResponse = await owner.agent
    .post('/api/chat/create-group-chat')
    .send({
      chatName: options.chatName ?? 'Mention Group',
      memberUsernames: [memberTwo.user.username, memberThree.user.username],
      ...(options.encryptionMode ? { encryptionMode: options.encryptionMode } : {}),
    })
    .expect(201);

  return {
    owner,
    memberTwo,
    memberThree,
    outsider,
    chatId: groupResponse.body.data.chat._id,
  };
};

const setupSpaceMentionScenario = async () => {
  await Spaces.init();
  await Chats.init();
  await Message.init();

  const owner = await signupWithAgent({ firstName: 'SpaceMention', lastName: 'Owner' });
  const member = await signupWithAgent({ firstName: 'SpaceMention', lastName: 'Member' });
  const outsider = await signupWithAgent({ firstName: 'SpaceMention', lastName: 'Outsider' });

  const created = await owner.agent
    .post('/api/space')
    .send({
      name: 'Mention Space',
      memberUsernames: [member.user.username],
    })
    .expect(201);

  return {
    owner,
    member,
    outsider,
    channelId: created.body.data.channel._id,
  };
};

describe('message mentions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists and serializes group member mentions without exposing email', async () => {
    const { memberTwo, memberThree, chatId } = await setupGroupMentionScenario();
    const text = `Can @${memberThree.user.username} review this?`;

    const created = await memberTwo.agent
      .post('/api/message/new-message')
      .send({
        chatId,
        text,
        clientMessageId: 'group-mention-success',
        mentionUserIds: [memberThree.user._id],
      })
      .expect(201);

    expect(created.body.data.message).toMatchObject({
      chatId,
      text,
      mentions: [
        {
          userId: memberThree.user._id.toString(),
          username: memberThree.user.username,
          displayName: 'Mention Three',
        },
      ],
    });
    expect(JSON.stringify(created.body)).not.toContain('"email"');

    const history = await memberThree.agent
      .get(`/api/message/get-all-messages/${chatId}`)
      .expect(200);

    expect(history.body.data.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        _id: created.body.data.message._id,
        mentions: [
          expect.objectContaining({
            userId: memberThree.user._id.toString(),
            username: memberThree.user.username,
          }),
        ],
      }),
    ]));
    expect(JSON.stringify(history.body)).not.toContain('"email"');
  });

  it('rejects hidden mention metadata and non-member targets', async () => {
    const { memberTwo, memberThree, outsider, chatId } = await setupGroupMentionScenario();

    const hiddenMention = await memberTwo.agent
      .post('/api/message/new-message')
      .send({
        chatId,
        text: 'No visible mention token here',
        clientMessageId: 'group-hidden-mention',
        mentionUserIds: [memberThree.user._id],
      })
      .expect(400);

    const outsiderMention = await memberTwo.agent
      .post('/api/message/new-message')
      .send({
        chatId,
        text: `Trying @${outsider.user.username}`,
        clientMessageId: 'group-outsider-mention',
        mentionUserIds: [outsider.user._id],
      })
      .expect(403);

    expect(hiddenMention.body.message).toMatch(/must appear/i);
    expect(outsiderMention.body.message).toMatch(/conversation members/i);
  });

  it('rejects mention metadata in direct and encrypted conversations', async () => {
    const { owner, memberTwo, memberThree, chatId } = await setupGroupMentionScenario({
      chatName: 'Encrypted Mention Group',
      encryptionMode: 'e2ee_v1',
    });
    const directChat = await Chats.create({
      members: [owner.user._id, memberTwo.user._id],
      isGroupChat: false,
    });

    const directMention = await owner.agent
      .post('/api/message/new-message')
      .send({
        chatId: directChat._id.toString(),
        text: `Hi @${memberTwo.user.username}`,
        clientMessageId: 'direct-mention-rejected',
        mentionUserIds: [memberTwo.user._id],
      })
      .expect(400);

    const encryptedMention = await owner.agent
      .post('/api/message/new-message')
      .send({
        chatId,
        text: '',
        clientMessageId: 'encrypted-mention-rejected',
        mentionUserIds: [memberThree.user._id],
      })
      .expect(400);

    expect(directMention.body.message).toMatch(/group conversations/i);
    expect(encryptedMention.body.code).toBe('encrypted_mentions_unavailable');
  });

  it('persists mentions in space channels through the existing message API', async () => {
    const { owner, member, channelId } = await setupSpaceMentionScenario();
    const text = `Channel note for @${member.user.username}`;

    const created = await owner.agent
      .post('/api/message/new-message')
      .send({
        chatId: channelId,
        text,
        clientMessageId: 'space-channel-mention-success',
        mentionUserIds: [member.user._id],
      })
      .expect(201);

    expect(created.body.data.message.mentions).toEqual([
      expect.objectContaining({
        userId: member.user._id.toString(),
        username: member.user.username,
        displayName: 'SpaceMention Member',
      }),
    ]);

    const history = await member.agent
      .get(`/api/message/get-all-messages/${channelId}`)
      .expect(200);

    expect(history.body.data.messages[0].mentions).toEqual([
      expect.objectContaining({
        userId: member.user._id.toString(),
        username: member.user.username,
      }),
    ]);
  });

  it('prunes mention metadata when an edit removes the visible username token', async () => {
    const { memberTwo, memberThree, chatId } = await setupGroupMentionScenario();
    const created = await memberTwo.agent
      .post('/api/message/new-message')
      .send({
        chatId,
        text: `Initial @${memberThree.user.username} mention`,
        clientMessageId: 'group-mention-edit-prune',
        mentionUserIds: [memberThree.user._id],
      })
      .expect(201);
    const messageId = created.body.data.message._id;

    const edited = await memberTwo.agent
      .patch(`/api/message/${messageId}/edit`)
      .send({ text: 'Initial mention removed' })
      .expect(200);

    expect(edited.body.data.message.mentions).toEqual([]);
  });

  it('treats changed mention targets as an idempotency conflict', async () => {
    const { owner, memberTwo, memberThree, chatId } = await setupGroupMentionScenario();
    const text = `Can @${owner.user.username} and @${memberThree.user.username} both see this?`;

    await memberTwo.agent
      .post('/api/message/new-message')
      .send({
        chatId,
        text,
        clientMessageId: 'group-mention-idempotent',
        mentionUserIds: [memberThree.user._id],
      })
      .expect(201);

    const changedMention = await memberTwo.agent
      .post('/api/message/new-message')
      .send({
        chatId,
        text,
        clientMessageId: 'group-mention-idempotent',
        mentionUserIds: [owner.user._id],
      })
      .expect(409);

    expect(changedMention.body.message).toMatch(/mentions/i);
  });
});
