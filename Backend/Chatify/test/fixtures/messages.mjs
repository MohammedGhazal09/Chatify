import Message from '../../Models/messageModel.mjs';

export const createMessage = async ({
  chat,
  sender,
  text = 'Hello from a test message',
  clientMessageId,
  overrides = {},
}) => {
  return Message.create({
    chatId: chat._id,
    sender: sender._id,
    clientMessageId,
    text,
    status: 'sent',
    ...overrides,
  });
};
