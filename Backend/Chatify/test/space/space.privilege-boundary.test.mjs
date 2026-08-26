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
    in: vi.fn(() => ({ emit: vi.fn() })),
  })),
}));

const setupUsers = async (count) => {
  await Spaces.init();
  await Chats.init();

  const users = [];
  for (let index = 0; index < count; index += 1) {
    users.push(await signupWithAgent({
      firstName: 'Privilege',
      lastName: `User${index + 1}`,
    }));
  }
  return users;
};

describe('space privilege boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows admins to manage ordinary members but not create or remove administrators', async () => {
    const [owner, admin, peerAdmin, attemptedAdmin, ordinaryMember] = await setupUsers(5);
    const created = await owner.agent
      .post('/api/space')
      .send({ name: 'Privilege Boundary' })
      .expect(201);
    const spaceId = created.body.data.space._id;

    await owner.agent
      .post(`/api/space/${spaceId}/members`)
      .send({ username: admin.user.username, role: 'admin' })
      .expect(200);
    await owner.agent
      .post(`/api/space/${spaceId}/members`)
      .send({ username: peerAdmin.user.username, role: 'admin' })
      .expect(200);

    await admin.agent
      .post(`/api/space/${spaceId}/members`)
      .send({ username: attemptedAdmin.user.username, role: 'admin' })
      .expect(403);

    await admin.agent
      .post(`/api/space/${spaceId}/members`)
      .send({ username: ordinaryMember.user.username })
      .expect(200);

    await admin.agent
      .delete(`/api/space/${spaceId}/members/${peerAdmin.user._id}`)
      .expect(403);

    await admin.agent
      .delete(`/api/space/${spaceId}/members/${ordinaryMember.user._id}`)
      .expect(200);

    const stored = await Spaces.findById(spaceId).lean();
    const membersById = new Map(stored.members.map((member) => [
      member.user.toString(),
      member.role,
    ]));

    expect(membersById.get(admin.user._id.toString())).toBe('admin');
    expect(membersById.get(peerAdmin.user._id.toString())).toBe('admin');
    expect(membersById.has(attemptedAdmin.user._id.toString())).toBe(false);
    expect(membersById.has(ordinaryMember.user._id.toString())).toBe(false);
  });

  it('rejects a stale administrator during the atomic membership update', async () => {
    const [owner, admin, target] = await setupUsers(3);
    const created = await owner.agent
      .post('/api/space')
      .send({ name: 'Atomic Authority' })
      .expect(201);
    const spaceId = created.body.data.space._id;

    await owner.agent
      .post(`/api/space/${spaceId}/members`)
      .send({ username: admin.user.username, role: 'admin' })
      .expect(200);

    await Spaces.updateOne(
      { _id: spaceId, 'members.user': admin.user._id },
      { $set: { 'members.$.role': 'member' } }
    );

    await admin.agent
      .post(`/api/space/${spaceId}/members`)
      .send({ username: target.user.username })
      .expect(403);

    expect(await Spaces.exists({
      _id: spaceId,
      'members.user': target.user._id,
    })).toBeNull();
  });
});
