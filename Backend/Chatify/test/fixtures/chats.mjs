import Chats from '../../Models/chatModel.mjs';

export const createDirectChat = async (members, overrides = {}) => {
  return Chats.create({
    members: members.map((member) => member._id),
    chatName: overrides.chatName ?? 'Direct test chat',
    isGroupChat: false,
    ...overrides,
  });
};
