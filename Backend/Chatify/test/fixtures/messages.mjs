import Message from '../../Models/messageModel.mjs';

export const createMessage = async ({ chat, sender, text = 'Hello from a test message', overrides = {} }) => {
  return Message.create({
    chatId: chat._id,
    sender: sender._id,
    text,
    status: 'sent',
    ...overrides,
  });
};
