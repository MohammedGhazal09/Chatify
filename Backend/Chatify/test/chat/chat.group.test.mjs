import { beforeEach, describe, expect, it, vi } from 'vitest';
import Chats from '../../Models/chatModel.mjs';
import UserBlock from '../../Models/userBlockModel.mjs';
import { emitToUserSockets, joinUserToChat } from '../../Config/socket.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

vi.mock('../../Config/socket.mjs', () => ({
  emitToUserSockets: vi.fn(),
  joinUserToChat: vi.fn(),
  removeUserFromChat: vi.fn(),
  getIO: vi.fn(() => ({
    to: vi.fn(() => ({
      emit: vi.fn(),
    })),
  })),
}));

const GROUP_START_ERROR = /could not create that group/i;

const signupGroupUser = (index) => signupWithAgent({
  firstName: 'Group',
  lastName: `Member${index}`,
});

const setupGroupUsers = async (count = 3) => {
  await Chats.init();
  await UserBlock.init();

  const users = [];

  for (let index = 0; index < count; index += 1) {
    users.push(await signupGroupUser(index + 1));
  }

  return users;
};

describe('group chat creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a private group chat by username without exposing emails', async () => {
    const [owner, memberTwo, memberThree] = await setupGroupUsers(3);

    const response = await owner.agent
      .post('/api/chat/create-group-chat')
      .send({
        chatName: 'Project Relay',
        memberUsernames: [
          memberTwo.user.username.toUpperCase(),
          ` ${memberThree.user.username} `,
        ],
      })
      .expect(201);

    const chat = await Chats.findById(response.body.data.chat._id).lean();

    expect(chat).toMatchObject({
      chatName: 'Project Relay',
      isGroupChat: true,
      groupAdmin: owner.user._id,
    });
    expect(chat.directKey).toBeUndefined();
    expect(chat.members.map((memberId) => memberId.toString()).sort()).toEqual([
      owner.user._id.toString(),
      memberTwo.user._id.toString(),
      memberThree.user._id.toString(),
    ].sort());
    expect(response.body.data.chat.members).toHaveLength(3);
    expect(response.body.data.chat.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ username: owner.user.username }),
        expect.objectContaining({ username: memberTwo.user.username }),
        expect.objectContaining({ username: memberThree.user.username }),
      ])
    );
    expect(JSON.stringify(response.body.data.chat)).not.toContain('"email"');
    expect(JSON.stringify(response.body.data.chat)).not.toContain(memberTwo.user.email);
    expect(response.body.data.chat.conversationControls).toMatchObject({
      isDirectChat: false,
      canSendMessage: true,
      canBlockUser: false,
      canUnblockUser: false,
    });
    expect(joinUserToChat).toHaveBeenCalledTimes(3);
    expect(emitToUserSockets).toHaveBeenCalledTimes(2);
    expect(emitToUserSockets.mock.calls.map((call) => call[1])).toEqual(['chat:new', 'chat:new']);
    expect(JSON.stringify(emitToUserSockets.mock.calls)).not.toContain('"email"');
  });

  it('enforces minimum and maximum group membership', async () => {
    const users = await setupGroupUsers(11);
    const [owner, ...members] = users;

    const tooSmall = await owner.agent
      .post('/api/chat/create-group-chat')
      .send({
        chatName: 'Tiny Group',
        memberUsernames: [members[0].user.username],
      })
      .expect(400);
    const tooLarge = await owner.agent
      .post('/api/chat/create-group-chat')
      .send({
        chatName: 'Large Group',
        memberUsernames: members.map((member) => member.user.username),
      })
      .expect(400);

    expect(tooSmall.body.message).toBe('Add at least two other members.');
    expect(tooLarge.body.message).toBe('Groups can have up to 10 members.');
    expect(await Chats.countDocuments({ isGroupChat: true })).toBe(0);
  });

  it('rejects duplicate, self, invalid, and missing usernames', async () => {
    const [owner, memberTwo, memberThree] = await setupGroupUsers(3);

    const duplicate = await owner.agent
      .post('/api/chat/create-group-chat')
      .send({
        chatName: 'Duplicate Group',
        memberUsernames: [memberTwo.user.username, memberTwo.user.username],
      })
      .expect(400);
    const selfTarget = await owner.agent
      .post('/api/chat/create-group-chat')
      .send({
        chatName: 'Self Group',
        memberUsernames: [owner.user.username, memberThree.user.username],
      })
      .expect(400);
    const invalid = await owner.agent
      .post('/api/chat/create-group-chat')
      .send({
        chatName: 'Invalid Group',
        memberUsernames: [memberTwo.user.username, 'not an username!'],
      })
      .expect(400);
    const missing = await owner.agent
      .post('/api/chat/create-group-chat')
      .send({
        chatName: 'Missing Group',
        memberUsernames: [memberTwo.user.username, 'missing.user'],
      })
      .expect(400);

    expect(duplicate.body.message).toBe('Each member username must be unique.');
    expect(selfTarget.body.message).toBe('Each member username must be unique.');
    expect(invalid.body.message).toBe('Use valid member usernames.');
    expect(missing.body.message).toMatch(GROUP_START_ERROR);
    expect(await Chats.countDocuments({ isGroupChat: true })).toBe(0);
  });

  it('rejects blocked member pairs without revealing which username failed', async () => {
    const [owner, blockedMember, memberThree] = await setupGroupUsers(3);
    await UserBlock.create({
      blocker: blockedMember.user._id,
      blockedUser: owner.user._id,
    });

    const response = await owner.agent
      .post('/api/chat/create-group-chat')
      .send({
        chatName: 'Blocked Group',
        memberUsernames: [blockedMember.user.username, memberThree.user.username],
      })
      .expect(400);

    expect(response.body.message).toMatch(GROUP_START_ERROR);
    expect(response.body.message).not.toContain(blockedMember.user.username);
    expect(await Chats.countDocuments({ isGroupChat: true })).toBe(0);
  });

  it('requires a group name and ignores legacy email member payloads', async () => {
    const [owner, memberTwo, memberThree] = await setupGroupUsers(3);

    const missingName = await owner.agent
      .post('/api/chat/create-group-chat')
      .send({
        chatName: ' ',
        memberUsernames: [memberTwo.user.username, memberThree.user.username],
      })
      .expect(400);
    const legacyEmailPayload = await owner.agent
      .post('/api/chat/create-group-chat')
      .send({
        chatName: 'Email Group',
        memberEmails: [memberTwo.user.email, memberThree.user.email],
      })
      .expect(400);

    expect(missingName.body.message).toBe('Enter a group name.');
    expect(legacyEmailPayload.body.message).toBe('Add at least two other members.');
    expect(await Chats.countDocuments({ isGroupChat: true })).toBe(0);
  });
});
