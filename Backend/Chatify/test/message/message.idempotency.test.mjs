import { describe, expect, it } from 'vitest';
import Message from '../../Models/messageModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const setupMessageScenario = async () => {
  await Message.init();

  const memberOne = await signupWithAgent({ firstName: 'Member', lastName: 'One' });
  const memberTwo = await signupWithAgent({ firstName: 'Member', lastName: 'Two' });
  const chat = await createDirectChat([memberOne.user, memberTwo.user]);

  return { memberOne, memberTwo, chat };
};

describe('message HTTP idempotency', () => {
  it('returns one persisted canonical message for duplicate clientMessageId retries', async () => {
    const { memberOne, chat } = await setupMessageScenario();
    const payload = {
      chatId: chat._id.toString(),
      text: ' Retried once ',
      clientMessageId: 'client-message-1',
    };

    const firstResponse = await memberOne.agent
      .post('/api/message/new-message')
      .send(payload)
      .expect(201);
    const secondResponse = await memberOne.agent
      .post('/api/message/new-message')
      .send(payload)
      .expect(200);

    const messages = await Message.find({
      chatId: chat._id,
      sender: memberOne.user._id,
      clientMessageId: payload.clientMessageId,
    });

    expect(messages).toHaveLength(1);
    expect(secondResponse.body.data.idempotent).toBe(true);
    expect(secondResponse.body.data.message._id).toBe(firstResponse.body.data.message._id);
    expect(firstResponse.body.data.message).toMatchObject({
      clientMessageId: payload.clientMessageId,
      chatId: chat._id.toString(),
      sender: memberOne.user._id.toString(),
      text: 'Retried once',
      status: 'sent',
      readBy: [],
      reactions: [],
      deletedFor: [],
      deletedForEveryone: false,
    });
    expect(firstResponse.body.data.message).toHaveProperty('createdAt');
    expect(firstResponse.body.data.message).toHaveProperty('updatedAt');
  });

  it('rejects clientMessageId reuse with different normalized text', async () => {
    const { memberOne, chat } = await setupMessageScenario();
    const basePayload = {
      chatId: chat._id.toString(),
      text: 'Original text',
      clientMessageId: 'client-message-conflict',
    };

    await memberOne.agent
      .post('/api/message/new-message')
      .send(basePayload)
      .expect(201);
    const conflictResponse = await memberOne.agent
      .post('/api/message/new-message')
      .send({ ...basePayload, text: 'Changed text' })
      .expect(409);

    expect(conflictResponse.body.message).toMatch(/different message text/i);
    await expect(Message.countDocuments({
      chatId: chat._id,
      sender: memberOne.user._id,
      clientMessageId: basePayload.clientMessageId,
    })).resolves.toBe(1);
  });

  it('derives sender from the authenticated user instead of request payload', async () => {
    const { memberOne, memberTwo, chat } = await setupMessageScenario();

    const response = await memberOne.agent
      .post('/api/message/new-message')
      .send({
        chatId: chat._id.toString(),
        sender: memberTwo.user._id.toString(),
        text: 'Cannot spoof sender',
        clientMessageId: 'client-message-spoof',
      })
      .expect(201);
    const storedMessage = await Message.findById(response.body.data.message._id);

    expect(response.body.data.message.sender).toBe(memberOne.user._id.toString());
    expect(storedMessage.sender.toString()).toBe(memberOne.user._id.toString());
  });
});
