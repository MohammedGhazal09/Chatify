import { describe, expect, it, vi, beforeEach } from 'vitest';
import Chats from '../../Models/chatModel.mjs';
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

const GENERIC_START_ERROR = /could not start or continue that chat/i;

const setupDirectChatUsers = async () => {
  await Chats.init();

  const requester = await signupWithAgent({
    firstName: 'Direct',
    lastName: 'Requester',
  });
  const target = await signupWithAgent({
    firstName: 'Direct',
    lastName: 'Target',
  });

  return { requester, target };
};

describe('direct chat continuation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a direct chat with a deterministic member-pair key', async () => {
    const { requester, target } = await setupDirectChatUsers();

    const response = await requester.agent
      .post('/api/chat/create-new-chat')
      .send({ targetEmail: ` ${target.user.email.toUpperCase()} ` })
      .expect(201);

    const chat = await Chats.findById(response.body.data.chat._id);
    const expectedDirectKey = [requester.user._id.toString(), target.user._id.toString()]
      .sort()
      .join(':');

    expect(chat.directKey).toBe(expectedDirectKey);
    expect(response.body.data.chat.members).toHaveLength(2);
    expect(joinUserToChat).toHaveBeenCalledTimes(2);
    expect(emitToUserSockets).toHaveBeenCalledTimes(1);
    expect(emitToUserSockets).toHaveBeenCalledWith(target.user._id, 'chat:new', expect.any(Object));
  });

  it('continues an existing exact-email direct chat with 200 semantics', async () => {
    const { requester, target } = await setupDirectChatUsers();

    const created = await requester.agent
      .post('/api/chat/create-new-chat')
      .send({ targetEmail: target.user.email })
      .expect(201);
    vi.clearAllMocks();

    const continued = await requester.agent
      .post('/api/chat/create-new-chat')
      .send({ targetEmail: target.user.email })
      .expect(200);

    expect(continued.body.data.chat._id).toBe(created.body.data.chat._id);
    expect(await Chats.countDocuments({ isGroupChat: false })).toBe(1);
    expect(joinUserToChat).not.toHaveBeenCalled();
    expect(emitToUserSockets).not.toHaveBeenCalled();
  });

  it('coalesces concurrent exact-email submits into one direct chat record', async () => {
    const { requester, target } = await setupDirectChatUsers();

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => requester.agent
        .post('/api/chat/create-new-chat')
        .send({ targetEmail: target.user.email }))
    );
    const ids = responses.map((response) => response.body.data.chat._id);

    expect(new Set(ids).size).toBe(1);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(await Chats.countDocuments({ isGroupChat: false })).toBe(1);
  });

  it('keeps missing-account and self-target failures privacy-safe', async () => {
    const { requester } = await setupDirectChatUsers();

    const missingAccount = await requester.agent
      .post('/api/chat/create-new-chat')
      .send({ targetEmail: 'missing-account@example.test' })
      .expect(404);
    const selfTarget = await requester.agent
      .post('/api/chat/create-new-chat')
      .send({ targetEmail: requester.user.email })
      .expect(400);

    expect(missingAccount.body.message).toMatch(GENERIC_START_ERROR);
    expect(missingAccount.body.message).not.toMatch(/does not exist|account exists/i);
    expect(selfTarget.body.message).toMatch(GENERIC_START_ERROR);
    expect(selfTarget.body.message).not.toMatch(/yourself|self/i);
  });

  it('keeps invalid email format feedback specific', async () => {
    const { requester } = await setupDirectChatUsers();

    const response = await requester.agent
      .post('/api/chat/create-new-chat')
      .send({ targetEmail: 'not-an-email' })
      .expect(400);

    expect(response.body.message).toBe('Please provide a valid email address');
  });
});
