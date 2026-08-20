import { beforeEach, describe, expect, it, vi } from 'vitest';
import Chats from '../../Models/chatModel.mjs';
import ConversationOrganization from '../../Models/conversationOrganizationModel.mjs';
import User from '../../Models/userModel.mjs';
import UserBlock from '../../Models/userBlockModel.mjs';
import { emitToUserSockets } from '../../Config/socket.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

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

const setupOrganizationScenario = async () => {
  await Chats.init();
  await UserBlock.init();
  await ConversationOrganization.init();

  const memberOne = await signupWithAgent({ firstName: 'Org', lastName: 'Owner' });
  const memberTwo = await signupWithAgent({ firstName: 'Org', lastName: 'Peer' });
  const outsider = await signupWithAgent({ firstName: 'Org', lastName: 'Outsider' });
  const chat = await createDirectChat([memberOne.user, memberTwo.user]);

  return { memberOne, memberTwo, outsider, chat };
};

const getChatFromList = (response, chatId) => (
  response.body.data.chats.find((chat) => chat._id === chatId.toString())
);

describe('conversation organization controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores archive, pin, favorite, and mute as requester-specific chat state', async () => {
    const { memberOne, memberTwo, chat } = await setupOrganizationScenario();

    const updated = await memberOne.agent
      .patch(`/api/chat/${chat._id}/organization`)
      .send({
        archived: true,
        pinned: true,
        favorite: true,
        muted: true,
      })
      .expect(200);

    expect(updated.body.data.organizationState).toEqual({
      archived: true,
      pinned: true,
      favorite: true,
      muted: true,
    });
    expect(JSON.stringify(updated.body.data.chat)).not.toContain('"email"');
    expect(JSON.stringify(updated.body.data.chat)).not.toContain(memberTwo.user.email);
    expect(emitToUserSockets).toHaveBeenCalledWith(
      memberOne.user._id.toString(),
      'conversation:organization-updated',
      expect.objectContaining({
        chatId: chat._id.toString(),
        organizationState: expect.objectContaining({ archived: true, pinned: true, favorite: true, muted: true }),
      })
    );

    const ownerList = await memberOne.agent.get('/api/chat/get-all-chats').expect(200);
    const peerList = await memberTwo.agent.get('/api/chat/get-all-chats').expect(200);
    const ownerChat = getChatFromList(ownerList, chat._id);
    const peerChat = getChatFromList(peerList, chat._id);

    expect(ownerChat.organizationState).toEqual({
      archived: true,
      pinned: true,
      favorite: true,
      muted: true,
    });
    expect(peerChat.organizationState).toEqual({
      archived: false,
      pinned: false,
      favorite: false,
      muted: false,
    });

    const refreshedOwner = await User.findById(memberOne.user._id).select('notificationPreferences.mutedChatIds').lean();
    expect(refreshedOwner.notificationPreferences.mutedChatIds.map((chatId) => chatId.toString())).toContain(
      chat._id.toString()
    );
    expect(await ConversationOrganization.countDocuments({ user: memberTwo.user._id })).toBe(0);
  });

  it('rejects non-member and invalid organization updates', async () => {
    const { memberOne, outsider, chat } = await setupOrganizationScenario();

    await outsider.agent
      .patch(`/api/chat/${chat._id}/organization`)
      .send({ favorite: true })
      .expect(404);

    const invalidType = await memberOne.agent
      .patch(`/api/chat/${chat._id}/organization`)
      .send({ pinned: 'yes' })
      .expect(400);

    const unknownField = await memberOne.agent
      .patch(`/api/chat/${chat._id}/organization`)
      .send({ snoozed: true })
      .expect(400);

    expect(invalidType.body.message).toBe('pinned must be a boolean');
    expect(unknownField.body.message).toMatch(/unsupported conversation organization field/i);
    expect(await ConversationOrganization.countDocuments()).toBe(0);
  });

  it('sorts pinned conversations before unpinned conversations without changing membership', async () => {
    await ConversationOrganization.init();
    const owner = await signupWithAgent({ firstName: 'Pinned', lastName: 'Owner' });
    const olderPeer = await signupWithAgent({ firstName: 'Pinned', lastName: 'Older' });
    const newerPeer = await signupWithAgent({ firstName: 'Pinned', lastName: 'Newer' });
    const olderChat = await createDirectChat([owner.user, olderPeer.user], { chatName: 'Older chat' });
    const newerChat = await createDirectChat([owner.user, newerPeer.user], { chatName: 'Newer chat' });

    await Chats.findByIdAndUpdate(
      olderChat._id,
      { updatedAt: new Date('2026-06-01T00:00:00.000Z') },
      { timestamps: false }
    );
    await Chats.findByIdAndUpdate(
      newerChat._id,
      { updatedAt: new Date('2026-06-02T00:00:00.000Z') },
      { timestamps: false }
    );

    await owner.agent
      .patch(`/api/chat/${olderChat._id}/organization`)
      .send({ pinned: true })
      .expect(200);

    const response = await owner.agent.get('/api/chat/get-all-chats').expect(200);
    const chatIds = response.body.data.chats.map((chat) => chat._id);

    expect(chatIds[0]).toBe(olderChat._id.toString());
    expect(chatIds).toContain(newerChat._id.toString());
  });
});
