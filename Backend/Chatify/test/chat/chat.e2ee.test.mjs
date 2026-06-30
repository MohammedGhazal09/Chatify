import { beforeEach, describe, expect, it, vi } from 'vitest';
import Chats from '../../Models/chatModel.mjs';
import ContactRequest, { CONTACT_REQUEST_STATUSES } from '../../Models/contactRequestModel.mjs';
import UserBlock from '../../Models/userBlockModel.mjs';
import { emitToUserSockets, joinUserToChat } from '../../Config/socket.mjs';
import { buildDirectChatKey } from '../../Utils/encryptionMode.mjs';
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

const setupDirectChatUsers = async () => {
  await Chats.init();
  await ContactRequest.init();
  await UserBlock.init();

  const requester = await signupWithAgent({
    firstName: 'Encrypted',
    lastName: 'Requester',
  });
  const target = await signupWithAgent({
    firstName: 'Encrypted',
    lastName: 'Target',
  });

  return { requester, target };
};

const seedAcceptedContactRequest = ({ requester, target }) => ContactRequest.create({
  requester: requester.user._id,
  recipient: target.user._id,
  status: CONTACT_REQUEST_STATUSES.ACCEPTED,
  respondedAt: new Date(),
});

const setupGroupUsers = async () => {
  await Chats.init();
  await UserBlock.init();

  const owner = await signupWithAgent({ firstName: 'Encrypted', lastName: 'Owner' });
  const memberTwo = await signupWithAgent({ firstName: 'Encrypted', lastName: 'MemberTwo' });
  const memberThree = await signupWithAgent({ firstName: 'Encrypted', lastName: 'MemberThree' });

  return { owner, memberTwo, memberThree };
};

describe('encrypted conversation creation contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows the same two members to have separate standard and encrypted direct chats', async () => {
    const { requester, target } = await setupDirectChatUsers();
    const members = [requester.user._id, target.user._id];
    await seedAcceptedContactRequest({ requester, target });

    const standard = await requester.agent
      .post('/api/chat/create-new-chat')
      .send({ targetUsername: target.user.username })
      .expect(201);
    const encrypted = await requester.agent
      .post('/api/chat/create-new-chat')
      .send({
        targetUsername: target.user.username,
        encryptionMode: 'e2ee_v1',
      })
      .expect(201);
    const repeatedEncrypted = await requester.agent
      .post('/api/chat/create-new-chat')
      .send({
        targetUsername: target.user.username,
        encryptionMode: 'e2ee_v1',
      })
      .expect(200);

    expect(standard.body.data.chat.encryptionMode).toBe('standard');
    expect(encrypted.body.data.chat.encryptionMode).toBe('e2ee_v1');
    expect(encrypted.body.data.chat._id).not.toBe(standard.body.data.chat._id);
    expect(repeatedEncrypted.body.data.chat._id).toBe(encrypted.body.data.chat._id);

    const chats = await Chats.find({ isGroupChat: false }).sort({ encryptionMode: 1 }).lean();
    expect(chats).toHaveLength(2);
    expect(chats.map((chat) => chat.directKey).sort()).toEqual([
      buildDirectChatKey(members),
      buildDirectChatKey(members, 'e2ee_v1'),
    ].sort());
    expect(joinUserToChat).toHaveBeenCalledTimes(4);
    expect(emitToUserSockets).toHaveBeenCalledTimes(2);
  });

  it('continues legacy standard direct chats that do not have an encryption mode field', async () => {
    const { requester, target } = await setupDirectChatUsers();
    const directKey = buildDirectChatKey([requester.user._id, target.user._id]);
    const now = new Date();
    const legacyInsert = await Chats.collection.insertOne({
      members: [requester.user._id, target.user._id],
      directKey,
      isGroupChat: false,
      chatName: 'Legacy direct chat',
      createdAt: now,
      updatedAt: now,
    });

    const response = await requester.agent
      .post('/api/chat/create-new-chat')
      .send({ targetUsername: target.user.username })
      .expect(200);

    expect(response.body.data.chat._id).toBe(legacyInsert.insertedId.toString());
    expect(response.body.data.chat.encryptionMode).toBe('standard');
    await expect(Chats.countDocuments({ isGroupChat: false })).resolves.toBe(1);
    expect(joinUserToChat).not.toHaveBeenCalled();
    expect(emitToUserSockets).not.toHaveBeenCalled();
  });

  it('stores encrypted mode on group conversations without exposing member emails', async () => {
    const { owner, memberTwo, memberThree } = await setupGroupUsers();

    const response = await owner.agent
      .post('/api/chat/create-group-chat')
      .send({
        chatName: 'Encrypted Launch Room',
        encryptionMode: 'e2ee_v1',
        memberUsernames: [memberTwo.user.username, memberThree.user.username],
      })
      .expect(201);
    const chat = await Chats.findById(response.body.data.chat._id).lean();

    expect(chat).toMatchObject({
      chatName: 'Encrypted Launch Room',
      isGroupChat: true,
      encryptionMode: 'e2ee_v1',
    });
    expect(response.body.data.chat.encryptionMode).toBe('e2ee_v1');
    expect(JSON.stringify(response.body.data.chat)).not.toContain(memberTwo.user.email);
  });
});
