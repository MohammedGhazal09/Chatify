import { describe, expect, it } from 'vitest';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createMessage } from '../fixtures/messages.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';
import { getTestApp } from '../setup/app.mjs';
import request from 'supertest';

const setupChatScenario = async () => {
  const memberOne = await signupWithAgent({ firstName: 'Member', lastName: 'One' });
  const memberTwo = await signupWithAgent({ firstName: 'Member', lastName: 'Two' });
  const outsider = await signupWithAgent({ firstName: 'Outside', lastName: 'User' });
  const chat = await createDirectChat([memberOne.user, memberTwo.user]);
  const message = await createMessage({ chat, sender: memberOne.user, text: 'Existing message' });

  return { memberOne, memberTwo, outsider, chat, message };
};

describe('message HTTP authorization', () => {
  it('rejects unauthenticated message creation', async () => {
    const app = await getTestApp();

    await request(app)
      .post('/api/message/new-message')
      .send({ chatId: '507f1f77bcf86cd799439011', text: 'No auth' })
      .expect(401);
  });

  it('rejects invalid chat ids for authenticated users', async () => {
    const { memberOne } = await setupChatScenario();

    const response = await memberOne.agent
      .post('/api/message/new-message')
      .send({ chatId: 'not-a-valid-object-id', text: 'Invalid chat id' })
      .expect(400);

    expect(response.body.message).toMatch(/Invalid chat id/i);
  });

  it('rejects non-members from fetching or creating messages in another chat', async () => {
    const { outsider, chat } = await setupChatScenario();

    await outsider.agent
      .get(`/api/message/get-all-messages/${chat._id}`)
      .expect(403);

    await outsider.agent
      .post('/api/message/new-message')
      .send({ chatId: chat._id.toString(), text: 'Outsider message' })
      .expect(403);
  });

  it('rejects non-members from mutating message state', async () => {
    const { outsider, message } = await setupChatScenario();

    await outsider.agent.patch(`/api/message/${message._id}/read`).expect(403);
    await outsider.agent
      .patch(`/api/message/${message._id}/edit`)
      .send({ text: 'Outsider edit' })
      .expect(403);
    await outsider.agent
      .delete(`/api/message/${message._id}`)
      .send({ deleteForEveryone: true })
      .expect(403);
    await outsider.agent
      .post(`/api/message/${message._id}/reaction`)
      .send({ emoji: 'ok' })
      .expect(403);
  });

  it('filters unauthorized chats from batch unread count requests', async () => {
    const { outsider, chat } = await setupChatScenario();

    const response = await outsider.agent
      .post('/api/message/batch/unread-counts')
      .send({ chatIds: [chat._id.toString()] })
      .expect(200);

    expect(response.body.data.counts).toEqual({});
  });

  it('allows chat members to fetch and create messages', async () => {
    const { memberOne, chat } = await setupChatScenario();

    const fetchResponse = await memberOne.agent
      .get(`/api/message/get-all-messages/${chat._id}`)
      .expect(200);

    expect(fetchResponse.body.data.messages).toHaveLength(1);

    const createResponse = await memberOne.agent
      .post('/api/message/new-message')
      .send({
        chatId: chat._id.toString(),
        text: 'Member message',
        clientMessageId: 'member-message-create',
      })
      .expect(201);

    expect(createResponse.body.data.message.text).toBe('Member message');
  });
});
