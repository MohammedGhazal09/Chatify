import { beforeEach, describe, expect, it, vi } from 'vitest';
import Chats from '../../Models/chatModel.mjs';
import Spaces from '../../Models/spaceModel.mjs';
import { emitToUserSockets, joinUserToChat } from '../../Config/socket.mjs';
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

const setupSpaceUsers = async (count = 3) => {
  await Spaces.init();
  await Chats.init();

  const users = [];

  for (let index = 0; index < count; index += 1) {
    users.push(await signupWithAgent({
      firstName: 'Space',
      lastName: `Member${index + 1}`,
    }));
  }

  return users;
};

describe('space contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a private space with a default channel by username without exposing emails', async () => {
    const [owner, member, outsider] = await setupSpaceUsers(3);

    const response = await owner.agent
      .post('/api/space')
      .send({
        name: 'Launch Room',
        description: 'Planning launch details',
        memberUsernames: [` ${member.user.username.toUpperCase()} `],
      })
      .expect(201);

    const { space, channel } = response.body.data;
    const persistedSpace = await Spaces.findById(space._id).lean();
    const persistedChannel = await Chats.findById(channel._id).lean();

    expect(persistedSpace).toMatchObject({
      name: 'Launch Room',
      description: 'Planning launch details',
      owner: owner.user._id,
      createdBy: owner.user._id,
    });
    expect(persistedSpace.members.map((spaceMember) => ({
      user: spaceMember.user.toString(),
      role: spaceMember.role,
    }))).toEqual(expect.arrayContaining([
      { user: owner.user._id.toString(), role: 'owner' },
      { user: member.user._id.toString(), role: 'member' },
    ]));
    expect(persistedSpace.defaultChannel.toString()).toBe(channel._id);
    expect(persistedChannel).toMatchObject({
      chatName: 'general',
      channelName: 'general',
      channelKey: 'general',
      isGroupChat: true,
      isSpaceChannel: true,
      space: persistedSpace._id,
      encryptionMode: 'standard',
    });
    expect(persistedChannel.members.map((memberId) => memberId.toString()).sort()).toEqual([
      owner.user._id.toString(),
      member.user._id.toString(),
    ].sort());
    expect(space.members).toHaveLength(2);
    expect(space.members).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'owner',
        user: expect.objectContaining({ username: owner.user.username }),
      }),
      expect.objectContaining({
        role: 'member',
        user: expect.objectContaining({ username: member.user.username }),
      }),
    ]));
    expect(channel.members).toEqual(expect.arrayContaining([
      expect.objectContaining({ username: owner.user.username }),
      expect.objectContaining({ username: member.user.username }),
    ]));
    expect(JSON.stringify(response.body.data)).not.toContain('"email"');
    expect(JSON.stringify(response.body.data)).not.toContain(member.user.email);
    expect(joinUserToChat).toHaveBeenCalledTimes(2);
    expect(emitToUserSockets).toHaveBeenCalledWith(
      member.user._id.toString(),
      'space:new',
      expect.objectContaining({ name: 'Launch Room' })
    );
    expect(JSON.stringify(emitToUserSockets.mock.calls)).not.toContain('"email"');

    const ownerChats = await owner.agent
      .get('/api/chat/get-all-chats')
      .expect(200);
    const memberChats = await member.agent
      .get('/api/chat/get-all-chats')
      .expect(200);
    const outsiderSpaces = await outsider.agent
      .get('/api/space')
      .expect(200);

    expect(ownerChats.body.data.chats).toHaveLength(0);
    expect(memberChats.body.data.chats).toHaveLength(0);
    expect(outsiderSpaces.body.data.spaces).toEqual([]);
  });

  it('keeps non-members out of space and channel metadata', async () => {
    const [owner, member, outsider] = await setupSpaceUsers(3);
    const created = await owner.agent
      .post('/api/space')
      .send({
        name: 'Private Ops',
        memberUsernames: [member.user.username],
      })
      .expect(201);
    const spaceId = created.body.data.space._id;

    const ownerDetail = await owner.agent
      .get(`/api/space/${spaceId}`)
      .expect(200);
    const memberChannels = await member.agent
      .get(`/api/space/${spaceId}/channels`)
      .expect(200);

    expect(ownerDetail.body.data.space.channels).toHaveLength(1);
    expect(memberChannels.body.data.channels).toHaveLength(1);

    await outsider.agent
      .get(`/api/space/${spaceId}`)
      .expect(404);
    await outsider.agent
      .get(`/api/space/${spaceId}/channels`)
      .expect(404);
  });

  it('rejects email identifiers, unsafe text, and channel limit overflows', async () => {
    const users = await setupSpaceUsers(2);
    const [owner, member] = users;

    const emailPayload = await owner.agent
      .post('/api/space')
      .send({
        name: 'Email Invite',
        memberUsernames: [member.user.email],
      })
      .expect(400);
    const unsafeName = await owner.agent
      .post('/api/space')
      .send({
        name: 'https://invalid.example',
      })
      .expect(400);

    expect(emailPayload.body.message).toBe('Use valid member usernames.');
    expect(unsafeName.body.message).toMatch(/plain text/i);
    expect(await Spaces.countDocuments()).toBe(0);

    const created = await owner.agent
      .post('/api/space')
      .send({ name: 'Channel Limits' })
      .expect(201);
    const spaceId = created.body.data.space._id;

    for (let index = 2; index <= 10; index += 1) {
      await owner.agent
        .post(`/api/space/${spaceId}/channels`)
        .send({ name: `team ${index}` })
        .expect(201);
    }

    const overflow = await owner.agent
      .post(`/api/space/${spaceId}/channels`)
      .send({ name: 'overflow' })
      .expect(400);

    expect(overflow.body.message).toBe('Spaces can have up to 10 channels.');
    expect(await Chats.countDocuments({ space: spaceId, isSpaceChannel: true })).toBe(10);
  });
});
