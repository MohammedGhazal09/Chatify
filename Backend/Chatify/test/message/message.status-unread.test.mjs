import { describe, expect, it } from 'vitest';
import Chats from '../../Models/chatModel.mjs';
import Message from '../../Models/messageModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createMessage } from '../fixtures/messages.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const setupReadScenario = async () => {
  await Message.init();

  const memberOne = await signupWithAgent({ firstName: 'Member', lastName: 'One' });
  const memberTwo = await signupWithAgent({ firstName: 'Member', lastName: 'Two' });
  const chat = await createDirectChat([memberOne.user, memberTwo.user]);

  return { memberOne, memberTwo, chat };
};

describe('message status and unread state', () => {
  it('derives unread counts per user from message readBy state', async () => {
    const { memberOne, memberTwo, chat } = await setupReadScenario();
    await createMessage({ chat, sender: memberOne.user, text: 'Unread for member two' });
    await Chats.findByIdAndUpdate(chat._id, { unReadMessages: 99 });

    const senderUnread = await memberOne.agent
      .get(`/api/message/${chat._id}/unread-count`)
      .expect(200);
    const recipientUnread = await memberTwo.agent
      .get(`/api/message/${chat._id}/unread-count`)
      .expect(200);

    expect(senderUnread.body.data.unreadCount).toBe(0);
    expect(recipientUnread.body.data.unreadCount).toBe(1);
  });

  it('marks a message read once, preserves first timestamps, and returns unread count', async () => {
    const { memberOne, memberTwo, chat } = await setupReadScenario();
    const message = await createMessage({ chat, sender: memberOne.user, text: 'Read once' });

    const firstResponse = await memberTwo.agent
      .patch(`/api/message/${message._id}/read`)
      .expect(200);
    const firstStored = await Message.findById(message._id);

    const secondResponse = await memberTwo.agent
      .patch(`/api/message/${message._id}/read`)
      .expect(200);
    const secondStored = await Message.findById(message._id);

    expect(firstResponse.body.data.message).toMatchObject({
      _id: message._id.toString(),
      status: 'read',
      read: true,
      sender: memberOne.user._id.toString(),
    });
    expect(firstResponse.body.data.message.deliveredAt).toEqual(expect.any(String));
    expect(firstResponse.body.data.message.readAt).toEqual(expect.any(String));
    expect(firstResponse.body.data.message.readBy).toEqual([
      {
        user: memberTwo.user._id.toString(),
        readAt: expect.any(String),
      },
    ]);
    expect(firstResponse.body.data.unreadCount).toBe(0);
    expect(secondResponse.body.data.unreadCount).toBe(0);
    expect(secondStored.readBy).toHaveLength(1);
    expect(secondStored.deliveredAt.getTime()).toBe(firstStored.deliveredAt.getTime());
    expect(secondStored.readAt.getTime()).toBe(firstStored.readAt.getTime());
  });

  it('does not let a sender mark their own message delivered or read through HTTP read', async () => {
    const { memberOne, chat } = await setupReadScenario();
    const message = await createMessage({ chat, sender: memberOne.user, text: 'Own read attempt' });

    const response = await memberOne.agent
      .patch(`/api/message/${message._id}/read`)
      .expect(200);
    const storedMessage = await Message.findById(message._id);

    expect(response.body.data.message.status).toBe('sent');
    expect(response.body.data.message.readBy).toEqual([]);
    expect(storedMessage.status).toBe('sent');
    expect(storedMessage.readBy).toHaveLength(0);
    expect(storedMessage.deliveredAt).toBeUndefined();
    expect(storedMessage.readAt).toBeUndefined();
  });

  it('batch read returns receipt patches and the authenticated user unread count', async () => {
    const { memberOne, memberTwo, chat } = await setupReadScenario();
    const firstMessage = await createMessage({ chat, sender: memberOne.user, text: 'Batch one' });
    const secondMessage = await createMessage({ chat, sender: memberOne.user, text: 'Batch two' });
    const ownMessage = await createMessage({ chat, sender: memberTwo.user, text: 'Do not mark own' });

    const response = await memberTwo.agent
      .patch(`/api/message/${chat._id}/mark-read`)
      .send({
        messageIds: [
          firstMessage._id.toString(),
          secondMessage._id.toString(),
          ownMessage._id.toString(),
        ],
      })
      .expect(200);

    expect(response.body.data.updatedCount).toBe(2);
    expect(response.body.data.unreadCount).toBe(0);
    expect(response.body.data.receipts).toHaveLength(2);
    expect(response.body.data.receipts.map((receipt) => receipt.status)).toEqual(['read', 'read']);
    await expect(Message.countDocuments({
      chatId: chat._id,
      sender: memberOne.user._id,
      'readBy.user': memberTwo.user._id,
    })).resolves.toBe(2);
  });
});
