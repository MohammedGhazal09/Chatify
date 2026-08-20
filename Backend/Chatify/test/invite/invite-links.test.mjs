import { beforeEach, describe, expect, it, vi } from 'vitest';
import Chats from '../../Models/chatModel.mjs';
import InviteLink from '../../Models/inviteLinkModel.mjs';
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

const extractToken = (inviteUrl) => {
  const url = new URL(inviteUrl);
  return decodeURIComponent(url.pathname.split('/').filter(Boolean).pop());
};

const createGroupScenario = async (options = {}) => {
  await Chats.init();
  await InviteLink.init();

  const owner = await signupWithAgent({ firstName: 'Invite', lastName: 'Owner' });
  const memberTwo = await signupWithAgent({ firstName: 'Invite', lastName: 'Two' });
  const memberThree = await signupWithAgent({ firstName: 'Invite', lastName: 'Three' });
  const outsider = await signupWithAgent({ firstName: 'Invite', lastName: 'Outsider' });
  const outsiderTwo = await signupWithAgent({ firstName: 'Invite', lastName: 'Second' });

  const groupResponse = await owner.agent
    .post('/api/chat/create-group-chat')
    .send({
      chatName: options.chatName ?? 'Invite Group',
      memberUsernames: [memberTwo.user.username, memberThree.user.username],
      ...(options.encryptionMode ? { encryptionMode: options.encryptionMode } : {}),
    })
    .expect(201);

  return {
    owner,
    memberTwo,
    memberThree,
    outsider,
    outsiderTwo,
    chatId: groupResponse.body.data.chat._id,
  };
};

const createSpaceScenario = async () => {
  await Spaces.init();
  await Chats.init();
  await InviteLink.init();

  const owner = await signupWithAgent({ firstName: 'SpaceInvite', lastName: 'Owner' });
  const member = await signupWithAgent({ firstName: 'SpaceInvite', lastName: 'Member' });
  const outsider = await signupWithAgent({ firstName: 'SpaceInvite', lastName: 'Outsider' });

  const created = await owner.agent
    .post('/api/space')
    .send({
      name: 'Invite Space',
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

describe('invite links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets group admins create and list metadata-only invite links', async () => {
    const { owner, memberTwo, chatId } = await createGroupScenario();

    const created = await owner.agent
      .post(`/api/invite/group/${chatId}`)
      .send({ expiresInDays: 7, maxUses: 5 })
      .expect(201);

    const token = extractToken(created.body.data.inviteUrl);
    expect(token).toHaveLength(43);
    expect(created.body.data.invite).toMatchObject({
      targetType: 'group',
      targetId: chatId,
      state: 'active',
      maxUses: 5,
      useCount: 0,
    });
    expect(JSON.stringify(created.body.data.invite)).not.toContain('tokenHash');

    const storedInvite = await InviteLink.findById(created.body.data.invite._id).select('+tokenHash');
    expect(storedInvite.tokenHash).toHaveLength(64);
    expect(storedInvite.tokenHash).not.toBe(token);

    const listed = await owner.agent
      .get(`/api/invite/group/${chatId}`)
      .expect(200);

    expect(listed.body.data.invites).toHaveLength(1);
    expect(JSON.stringify(listed.body)).not.toContain(token);
    expect(JSON.stringify(listed.body)).not.toContain('tokenHash');

    await memberTwo.agent
      .post(`/api/invite/group/${chatId}`)
      .send({ expiresInDays: 7 })
      .expect(403);
  });

  it('joins a group through an active invite and treats repeat joins as already-member success', async () => {
    const { owner, outsider, chatId } = await createGroupScenario();
    const created = await owner.agent
      .post(`/api/invite/group/${chatId}`)
      .send({ expiresInDays: 7, maxUses: 1 })
      .expect(201);
    const token = extractToken(created.body.data.inviteUrl);

    const joined = await outsider.agent
      .post('/api/invite/join')
      .send({ token })
      .expect(200);

    expect(joined.body.data).toMatchObject({
      targetType: 'group',
      alreadyMember: false,
      chat: {
        _id: chatId,
        isGroupChat: true,
      },
    });

    const chat = await Chats.findById(chatId);
    expect(chat.members.map((member) => member.toString())).toContain(outsider.user._id.toString());

    const afterJoin = await InviteLink.findById(created.body.data.invite._id);
    expect(afterJoin.useCount).toBe(1);

    const repeated = await outsider.agent
      .post('/api/invite/join')
      .send({ token })
      .expect(200);

    expect(repeated.body.data.alreadyMember).toBe(true);
    const afterRepeat = await InviteLink.findById(created.body.data.invite._id);
    expect(afterRepeat.useCount).toBe(1);
  });

  it('does not exceed max uses when group invite joins race', async () => {
    const { owner, outsider, outsiderTwo, chatId } = await createGroupScenario();
    const created = await owner.agent
      .post(`/api/invite/group/${chatId}`)
      .send({ expiresInDays: 7, maxUses: 1 })
      .expect(201);
    const token = extractToken(created.body.data.inviteUrl);

    const [firstJoin, secondJoin] = await Promise.all([
      outsider.agent.post('/api/invite/join').send({ token }),
      outsiderTwo.agent.post('/api/invite/join').send({ token }),
    ]);

    expect([firstJoin.statusCode, secondJoin.statusCode].sort()).toEqual([200, 410]);

    const chat = await Chats.findById(chatId);
    const joinedOutsiders = chat.members
      .map((member) => member.toString())
      .filter((memberId) => [
        outsider.user._id.toString(),
        outsiderTwo.user._id.toString(),
      ].includes(memberId));
    expect(joinedOutsiders).toHaveLength(1);

    const invite = await InviteLink.findById(created.body.data.invite._id);
    expect(invite.useCount).toBe(1);
  });

  it('rejects revoked, expired, and exhausted invite links safely', async () => {
    const { owner, outsider, outsiderTwo, chatId } = await createGroupScenario();

    const revoked = await owner.agent
      .post(`/api/invite/group/${chatId}`)
      .send({ expiresInDays: 7 })
      .expect(201);
    const revokedToken = extractToken(revoked.body.data.inviteUrl);

    await owner.agent
      .delete(`/api/invite/${revoked.body.data.invite._id}`)
      .expect(200);
    await outsider.agent
      .post('/api/invite/join')
      .send({ token: revokedToken })
      .expect(410);

    const expired = await owner.agent
      .post(`/api/invite/group/${chatId}`)
      .send({ expiresInDays: 1 })
      .expect(201);
    const expiredToken = extractToken(expired.body.data.inviteUrl);
    await InviteLink.findByIdAndUpdate(expired.body.data.invite._id, {
      expiresAt: new Date(Date.now() - 1000),
    });

    await outsider.agent
      .post('/api/invite/join')
      .send({ token: expiredToken })
      .expect(410);

    const oneUse = await owner.agent
      .post(`/api/invite/group/${chatId}`)
      .send({ expiresInDays: 7, maxUses: 1 })
      .expect(201);
    const oneUseToken = extractToken(oneUse.body.data.inviteUrl);

    await outsider.agent
      .post('/api/invite/join')
      .send({ token: oneUseToken })
      .expect(200);
    await outsiderTwo.agent
      .post('/api/invite/join')
      .send({ token: oneUseToken })
      .expect(410);
  });

  it('rejects invite management for encrypted group conversations', async () => {
    const { owner, chatId } = await createGroupScenario({
      chatName: 'Encrypted Invite Group',
      encryptionMode: 'e2ee_v1',
    });

    const response = await owner.agent
      .post(`/api/invite/group/${chatId}`)
      .send({ expiresInDays: 7 })
      .expect(400);

    expect(response.body.message).toMatch(/encrypted/i);
  });

  it('lets space managers create links and lets invitees join the space and channels', async () => {
    const { owner, outsider, spaceId, channelId } = await createSpaceScenario();

    const created = await owner.agent
      .post(`/api/invite/space/${spaceId}`)
      .send({ expiresInDays: 7, maxUses: 5 })
      .expect(201);
    const token = extractToken(created.body.data.inviteUrl);

    const joined = await outsider.agent
      .post('/api/invite/join')
      .send({ token })
      .expect(200);

    expect(joined.body.data).toMatchObject({
      targetType: 'space',
      alreadyMember: false,
      space: {
        _id: spaceId,
        memberCount: 3,
      },
    });

    const [space, channel] = await Promise.all([
      Spaces.findById(spaceId),
      Chats.findById(channelId),
    ]);

    expect(space.members.map((member) => member.user.toString())).toContain(outsider.user._id.toString());
    expect(channel.members.map((member) => member.toString())).toContain(outsider.user._id.toString());

    const listed = await owner.agent
      .get(`/api/invite/space/${spaceId}`)
      .expect(200);

    expect(listed.body.data.invites[0]).toMatchObject({
      targetType: 'space',
      targetId: spaceId,
      useCount: 1,
    });
  });
});
