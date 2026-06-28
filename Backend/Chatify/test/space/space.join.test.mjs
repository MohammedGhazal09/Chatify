import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Chats from '../../Models/chatModel.mjs';
import Spaces, { SPACE_LIMITS } from '../../Models/spaceModel.mjs';
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

const setupUsers = async (count = 3) => {
  await Spaces.init();
  await Chats.init();

  const users = [];

  for (let index = 0; index < count; index += 1) {
    users.push(await signupWithAgent({
      firstName: 'Join',
      lastName: `User${index + 1}`,
    }));
  }

  return users;
};

const createSpace = async (owner, name = 'Join Room') => {
  const created = await owner.agent
    .post('/api/space')
    .send({ name })
    .expect(201);

  return created.body.data.space;
};

describe('space join by code', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('issues a join code on create that only managers can see', async () => {
    const [owner, member] = await setupUsers(2);
    const space = await createSpace(owner);

    expect(space.joinCode).toMatch(/^[A-Z0-9]{8}$/);

    await owner.agent
      .post(`/api/space/${space._id}/members`)
      .send({ username: member.user.username })
      .expect(200);

    const memberView = await member.agent
      .get(`/api/space/${space._id}`)
      .expect(200);

    expect(memberView.body.data.space.joinCode).toBeUndefined();
    expect(JSON.stringify(memberView.body.data.space)).not.toContain(space.joinCode);
  });

  it('lets a new user self-join with a valid code and gains channel access', async () => {
    const [owner, joiner] = await setupUsers(2);
    const space = await createSpace(owner);

    const response = await joiner.agent
      .post('/api/space/join')
      .send({ joinCode: space.joinCode.toLowerCase() })
      .expect(200);

    expect(response.body.data.space.members).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'member',
        user: expect.objectContaining({ username: joiner.user.username }),
      }),
    ]));
    expect(response.body.data.space.channels).toHaveLength(1);
    expect(joinUserToChat).toHaveBeenCalled();
    expect(emitToUserSockets).toHaveBeenCalledWith(
      joiner.user._id.toString(),
      'space:new',
      expect.objectContaining({ _id: space._id })
    );

    const channelCount = await Chats.countDocuments({
      space: space._id,
      isSpaceChannel: true,
      members: joiner.user._id,
    });
    expect(channelCount).toBe(1);

    const joinerSpaces = await joiner.agent.get('/api/space').expect(200);
    expect(joinerSpaces.body.data.spaces).toHaveLength(1);
  });

  it('rejects an unknown code, a duplicate join, and an invalid code shape', async () => {
    const [owner, joiner] = await setupUsers(2);
    const space = await createSpace(owner);

    const unknown = await joiner.agent
      .post('/api/space/join')
      .send({ joinCode: 'ZZZZ2345' })
      .expect(404);
    expect(unknown.body.message).toBe('Space not found');

    const invalid = await joiner.agent
      .post('/api/space/join')
      .send({ joinCode: 'short' })
      .expect(400);
    expect(invalid.body.message).toBe('Enter a valid join code.');

    await joiner.agent
      .post('/api/space/join')
      .send({ joinCode: space.joinCode })
      .expect(200);

    const duplicate = await joiner.agent
      .post('/api/space/join')
      .send({ joinCode: space.joinCode })
      .expect(409);
    expect(duplicate.body.message).toBe('You are already a member of this space.');

    const ownerDuplicate = await owner.agent
      .post('/api/space/join')
      .send({ joinCode: space.joinCode })
      .expect(409);
    expect(ownerDuplicate.body.message).toBe('You are already a member of this space.');
  });

  it('rejects joining once the space is at the member limit', async () => {
    const [owner, joiner] = await setupUsers(2);
    const created = await createSpace(owner);

    // Pad the space to the member cap with placeholder ids to exercise the guard.
    const padded = await Spaces.findById(created._id);
    while (padded.members.length < SPACE_LIMITS.members) {
      padded.members.push({ user: new mongoose.Types.ObjectId(), role: 'member' });
    }
    await padded.save();

    const full = await joiner.agent
      .post('/api/space/join')
      .send({ joinCode: created.joinCode })
      .expect(400);

    expect(full.body.message).toBe(`Spaces can have up to ${SPACE_LIMITS.members} members.`);
  });

  it('persists every member when two users join concurrently', async () => {
    const [owner, joinerA, joinerB] = await setupUsers(3);
    const space = await createSpace(owner);

    const [resA, resB] = await Promise.all([
      joinerA.agent.post('/api/space/join').send({ joinCode: space.joinCode }),
      joinerB.agent.post('/api/space/join').send({ joinCode: space.joinCode }),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const persisted = await Spaces.findById(space._id).lean();
    const memberIds = persisted.members.map((member) => member.user.toString());

    expect(persisted.members).toHaveLength(3);
    expect(memberIds).toContain(joinerA.user._id.toString());
    expect(memberIds).toContain(joinerB.user._id.toString());

    const channelMemberCount = await Chats.countDocuments({
      space: space._id,
      isSpaceChannel: true,
      members: { $all: [joinerA.user._id, joinerB.user._id] },
    });
    expect(channelMemberCount).toBe(1);
  });
});
