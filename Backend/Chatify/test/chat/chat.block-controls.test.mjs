import { beforeEach, describe, expect, it, vi } from 'vitest';
import Chats from '../../Models/chatModel.mjs';
import UserBlock from '../../Models/userBlockModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';
import { emitToUserSockets } from '../../Config/socket.mjs';

vi.mock('../../Config/socket.mjs', () => ({
  emitToUserSockets: vi.fn(),
  endActiveCallForChatDueToBlock: vi.fn(),
  joinUserToChat: vi.fn(),
  removeUserFromChat: vi.fn(),
  getIO: vi.fn(() => ({
    to: vi.fn(() => ({
      emit: vi.fn(),
    })),
  })),
}));

const setupBlockScenario = async () => {
  await UserBlock.init();

  const memberOne = await signupWithAgent({ firstName: 'Block', lastName: 'Owner' });
  const memberTwo = await signupWithAgent({ firstName: 'Block', lastName: 'Peer' });
  const chat = await createDirectChat([memberOne.user, memberTwo.user]);

  return { memberOne, memberTwo, chat };
};

describe('conversation controls and direct chat blocking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes direct-chat conversation controls before and after block', async () => {
    const { memberOne, memberTwo, chat } = await setupBlockScenario();

    const initial = await memberOne.agent
      .get('/api/chat/get-all-chats')
      .expect(200);
    const initialChat = initial.body.data.chats.find((item) => item._id === chat._id.toString());

    expect(initialChat.conversationControls).toMatchObject({
      isDirectChat: true,
      peerId: memberTwo.user._id.toString(),
      canSendMessage: true,
      canBlockUser: true,
      canUnblockUser: false,
      blockedByMe: false,
      blockedMe: false,
      messagingDisabledReason: null,
    });

    const blocked = await memberOne.agent
      .post(`/api/chat/${chat._id}/block`)
      .expect(200);

    expect(blocked.body.data.conversationControls).toMatchObject({
      isDirectChat: true,
      peerId: memberTwo.user._id.toString(),
      canSendMessage: false,
      canBlockUser: false,
      canUnblockUser: true,
      blockedByMe: true,
      blockedMe: false,
      messagingDisabledReason: 'blocked_by_me',
    });
    expect(emitToUserSockets).toHaveBeenCalledTimes(2);

    const peerView = await memberTwo.agent
      .get('/api/chat/get-all-chats')
      .expect(200);
    const peerChat = peerView.body.data.chats.find((item) => item._id === chat._id.toString());

    expect(peerChat.conversationControls).toMatchObject({
      isDirectChat: true,
      peerId: memberOne.user._id.toString(),
      canSendMessage: false,
      canBlockUser: true,
      canUnblockUser: false,
      blockedByMe: false,
      blockedMe: true,
      messagingDisabledReason: 'blocked_me',
    });
  });

  it('keeps block and unblock idempotent for a direct chat pair', async () => {
    const { memberOne, chat } = await setupBlockScenario();

    await memberOne.agent.post(`/api/chat/${chat._id}/block`).expect(200);
    await memberOne.agent.post(`/api/chat/${chat._id}/block`).expect(200);

    await expect(UserBlock.countDocuments()).resolves.toBe(1);

    const unblocked = await memberOne.agent
      .delete(`/api/chat/${chat._id}/block`)
      .expect(200);

    expect(unblocked.body.data.conversationControls).toMatchObject({
      canSendMessage: true,
      blockedByMe: false,
      blockedMe: false,
      messagingDisabledReason: null,
    });

    await memberOne.agent.delete(`/api/chat/${chat._id}/block`).expect(200);
    await expect(UserBlock.countDocuments()).resolves.toBe(0);
  });

  it('rejects group-chat blocking', async () => {
    const memberOne = await signupWithAgent({ firstName: 'Group', lastName: 'One' });
    const memberTwo = await signupWithAgent({ firstName: 'Group', lastName: 'Two' });
    const memberThree = await signupWithAgent({ firstName: 'Group', lastName: 'Three' });
    const groupChat = await Chats.create({
      members: [memberOne.user._id, memberTwo.user._id, memberThree.user._id],
      isGroupChat: true,
      chatName: 'Group block test',
    });

    const response = await memberOne.agent
      .post(`/api/chat/${groupChat._id}/block`)
      .expect(400);

    expect(response.body.message).toMatch(/direct chats/i);
  });
});
