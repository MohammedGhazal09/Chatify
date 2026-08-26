import { beforeEach, describe, expect, it, vi } from 'vitest';
import Chats from '../../Models/chatModel.mjs';
import ContactRequest, { CONTACT_REQUEST_STATUSES } from '../../Models/contactRequestModel.mjs';
import UserBlock from '../../Models/userBlockModel.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

vi.mock('../../Config/socket.mjs', () => ({
  emitToUserSockets: vi.fn(),
  joinUserToChat: vi.fn(),
  removeUserFromChat: vi.fn(),
  getIO: vi.fn(() => ({
    to: vi.fn(() => ({ emit: vi.fn() })),
  })),
}));

const createDirectConversation = async () => {
  await Chats.init();
  await ContactRequest.init();
  await UserBlock.init();

  const first = await signupWithAgent({
    firstName: 'Delete',
    lastName: 'First',
  });
  const second = await signupWithAgent({
    firstName: 'Delete',
    lastName: 'Second',
  });

  await ContactRequest.create({
    requester: first.user._id,
    recipient: second.user._id,
    status: CONTACT_REQUEST_STATUSES.ACCEPTED,
    respondedAt: new Date(),
  });

  const response = await first.agent
    .post('/api/chat/create-new-chat')
    .send({ targetUsername: second.user.username })
    .expect(201);

  return {
    first,
    second,
    chatId: response.body.data.chat._id,
  };
};

describe('shared chat deletion safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prevents either direct-chat participant from deleting shared history', async () => {
    const { first, second, chatId } = await createDirectConversation();

    const firstAttempt = await first.agent
      .delete(`/api/chat/${chatId}`)
      .expect(403);
    const secondAttempt = await second.agent
      .delete(`/api/chat/${chatId}`)
      .expect(403);

    expect(firstAttempt.body.message).toMatch(/direct conversations cannot be deleted/i);
    expect(secondAttempt.body.message).toMatch(/direct conversations cannot be deleted/i);
    await expect(Chats.findById(chatId)).resolves.toBeTruthy();
  });
});
