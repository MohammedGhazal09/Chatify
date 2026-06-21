import { beforeEach, describe, expect, it, vi } from 'vitest';
import Chats from '../../Models/chatModel.mjs';
import Spaces from '../../Models/spaceModel.mjs';
import { emitToUserSockets, joinUserToChat, removeUserFromChat } from '../../Config/socket.mjs';
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

const setupUsers = async (count = 4) => {
  await Spaces.init();
  await Chats.init();

  const users = [];

  for (let index = 0; index < count; index += 1) {
    users.push(await signupWithAgent({
      firstName: 'Member',
      lastName: `User${index + 1}`,
    }));
  }

  return users;
};

describe('space membership controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets owner and admins add members by username without exposing emails', async () => {
    const [owner, admin, member, laterMember] = await setupUsers(4);
    const created = await owner.agent
      .post('/api/space')
      .send({
        name: 'Role Room',
        memberUsernames: [admin.user.username],
      })
      .expect(201);
    const spaceId = created.body.data.space._id;

    const promoteAdmin = await owner.agent
      .post(`/api/space/${spaceId}/members`)
      .send({
        username: member.user.username,
        role: 'admin',
      })
      .expect(200);

    expect(promoteAdmin.body.data.space.members).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'admin',
        user: expect.objectContaining({ username: member.user.username }),
      }),
    ]));

    const adminAdd = await member.agent
      .post(`/api/space/${spaceId}/members`)
      .send({
        username: laterMember.user.username,
      })
      .expect(200);

    expect(adminAdd.body.data.space.members).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'member',
        user: expect.objectContaining({ username: laterMember.user.username }),
      }),
    ]));
    expect(JSON.stringify(adminAdd.body.data.space)).not.toContain('"email"');
    expect(joinUserToChat).toHaveBeenCalled();
    expect(JSON.stringify(emitToUserSockets.mock.calls)).not.toContain('"email"');
  });

  it('blocks regular members from mutating membership or creating channels', async () => {
    const [owner, member, target] = await setupUsers(3);
    const created = await owner.agent
      .post('/api/space')
      .send({
        name: 'Member Boundary',
        memberUsernames: [member.user.username],
      })
      .expect(201);
    const spaceId = created.body.data.space._id;

    const addDenied = await member.agent
      .post(`/api/space/${spaceId}/members`)
      .send({ username: target.user.username })
      .expect(403);
    const channelDenied = await member.agent
      .post(`/api/space/${spaceId}/channels`)
      .send({ name: 'members only' })
      .expect(403);

    expect(addDenied.body.message).toMatch(/owner or admin/i);
    expect(channelDenied.body.message).toMatch(/owner or admin/i);
    expect(await Spaces.findOne({ _id: spaceId, 'members.user': target.user._id })).toBeNull();
    expect(await Chats.countDocuments({ space: spaceId, isSpaceChannel: true })).toBe(1);
  });

  it('removes non-owner members from every channel and revokes message access', async () => {
    const [owner, member] = await setupUsers(2);
    const created = await owner.agent
      .post('/api/space')
      .send({
        name: 'Removal Room',
        memberUsernames: [member.user.username],
      })
      .expect(201);
    const spaceId = created.body.data.space._id;
    const defaultChannelId = created.body.data.channel._id;

    await owner.agent
      .post(`/api/space/${spaceId}/channels`)
      .send({ name: 'ops updates' })
      .expect(201);

    const memberChannels = await member.agent
      .get(`/api/space/${spaceId}/channels`)
      .expect(200);
    expect(memberChannels.body.data.channels).toHaveLength(2);

    const removal = await owner.agent
      .delete(`/api/space/${spaceId}/members/${member.user._id}`)
      .expect(200);

    expect(removal.body.data.space.members).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: member.user._id.toString() }),
    ]));
    expect(removeUserFromChat).toHaveBeenCalledTimes(2);
    expect(emitToUserSockets).toHaveBeenCalledWith(
      member.user._id.toString(),
      'space:removed',
      expect.objectContaining({ spaceId })
    );

    const defaultChannel = await Chats.findById(defaultChannelId).lean();
    expect(defaultChannel.members.map((memberId) => memberId.toString())).not.toContain(member.user._id.toString());

    await member.agent
      .get(`/api/space/${spaceId}`)
      .expect(404);
    await member.agent
      .get(`/api/message/get-all-messages/${defaultChannelId}`)
      .expect(403);
  });

  it('prevents removing the owner and rejects duplicate members', async () => {
    const [owner, member] = await setupUsers(2);
    const created = await owner.agent
      .post('/api/space')
      .send({
        name: 'Owner Room',
        memberUsernames: [member.user.username],
      })
      .expect(201);
    const spaceId = created.body.data.space._id;

    const duplicate = await owner.agent
      .post(`/api/space/${spaceId}/members`)
      .send({ username: member.user.username })
      .expect(409);
    const ownerRemoval = await owner.agent
      .delete(`/api/space/${spaceId}/members/${owner.user._id}`)
      .expect(403);

    expect(duplicate.body.message).toBe('User is already a space member.');
    expect(ownerRemoval.body.message).toMatch(/owner cannot be removed/i);
    expect(await Spaces.findOne({ _id: spaceId, owner: owner.user._id })).toBeTruthy();
  });
});
