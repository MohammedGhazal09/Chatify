import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import Message from '../../Models/messageModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createMessage } from '../fixtures/messages.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const setupPaginationScenario = async () => {
  await Message.init();

  const memberOne = await signupWithAgent({ firstName: 'Member', lastName: 'One' });
  const memberTwo = await signupWithAgent({ firstName: 'Member', lastName: 'Two' });
  const chat = await createDirectChat([memberOne.user, memberTwo.user]);

  return { memberOne, memberTwo, chat };
};

const createTimedMessage = async ({ chat, sender, text, timestamp, id }) => {
  return createMessage({
    chat,
    sender,
    text,
    overrides: {
      _id: id ? new mongoose.Types.ObjectId(id) : undefined,
      createdAt: new Date(timestamp),
      updatedAt: new Date(timestamp),
    },
  });
};

describe('message cursor pagination', () => {
  it('returns the first page in display order with a next cursor', async () => {
    const { memberOne, chat } = await setupPaginationScenario();

    for (let index = 1; index <= 5; index += 1) {
      await createTimedMessage({
        chat,
        sender: memberOne.user,
        text: `Message ${index}`,
        timestamp: `2026-06-08T10:0${index}:00.000Z`,
      });
    }

    const response = await memberOne.agent
      .get(`/api/message/get-all-messages/${chat._id}?limit=2`)
      .expect(200);

    expect(response.body.data.messages.map((message) => message.text)).toEqual(['Message 4', 'Message 5']);
    expect(response.body.data.hasMore).toBe(true);
    expect(response.body.data.nextCursor).toEqual(expect.any(String));
    expect(response.body.data.cursor).toMatchObject({
      hasMore: true,
      limit: 2,
      nextCursor: response.body.data.nextCursor,
    });
  });

  it('returns older messages before the cursor without duplicates', async () => {
    const { memberOne, chat } = await setupPaginationScenario();

    for (let index = 1; index <= 5; index += 1) {
      await createTimedMessage({
        chat,
        sender: memberOne.user,
        text: `Message ${index}`,
        timestamp: `2026-06-08T10:0${index}:00.000Z`,
      });
    }

    const firstPage = await memberOne.agent
      .get(`/api/message/get-all-messages/${chat._id}?limit=2`)
      .expect(200);
    const secondPage = await memberOne.agent
      .get(`/api/message/get-all-messages/${chat._id}?limit=2&before=${encodeURIComponent(firstPage.body.data.nextCursor)}`)
      .expect(200);

    expect(secondPage.body.data.messages.map((message) => message.text)).toEqual(['Message 2', 'Message 3']);
    expect(new Set([
      ...firstPage.body.data.messages.map((message) => message._id),
      ...secondPage.body.data.messages.map((message) => message._id),
    ])).toHaveProperty('size', 4);
  });

  it('uses _id as a stable tie-breaker when messages share createdAt', async () => {
    const { memberOne, chat } = await setupPaginationScenario();
    const sameTimestamp = '2026-06-08T10:00:00.000Z';

    await createTimedMessage({
      chat,
      sender: memberOne.user,
      text: 'Tie 1',
      timestamp: sameTimestamp,
      id: '000000000000000000000001',
    });
    await createTimedMessage({
      chat,
      sender: memberOne.user,
      text: 'Tie 2',
      timestamp: sameTimestamp,
      id: '000000000000000000000002',
    });
    await createTimedMessage({
      chat,
      sender: memberOne.user,
      text: 'Tie 3',
      timestamp: sameTimestamp,
      id: '000000000000000000000003',
    });

    const firstPage = await memberOne.agent
      .get(`/api/message/get-all-messages/${chat._id}?limit=2`)
      .expect(200);
    const secondPage = await memberOne.agent
      .get(`/api/message/get-all-messages/${chat._id}?limit=2&before=${encodeURIComponent(firstPage.body.data.nextCursor)}`)
      .expect(200);

    expect(firstPage.body.data.messages.map((message) => message.text)).toEqual(['Tie 2', 'Tie 3']);
    expect(secondPage.body.data.messages.map((message) => message.text)).toEqual(['Tie 1']);
  });

  it('filters messages deleted for the requesting user only', async () => {
    const { memberOne, memberTwo, chat } = await setupPaginationScenario();
    const visibleMessage = await createTimedMessage({
      chat,
      sender: memberOne.user,
      text: 'Still visible',
      timestamp: '2026-06-08T10:00:00.000Z',
    });
    const hiddenMessage = await createTimedMessage({
      chat,
      sender: memberOne.user,
      text: 'Hidden for member two',
      timestamp: '2026-06-08T10:01:00.000Z',
    });

    await memberTwo.agent
      .delete(`/api/message/${hiddenMessage._id}`)
      .send({ deleteForEveryone: false })
      .expect(200);

    const memberTwoHistory = await memberTwo.agent
      .get(`/api/message/get-all-messages/${chat._id}?limit=10`)
      .expect(200);
    const memberOneHistory = await memberOne.agent
      .get(`/api/message/get-all-messages/${chat._id}?limit=10`)
      .expect(200);

    expect(memberTwoHistory.body.data.messages.map((message) => message._id)).toEqual([visibleMessage._id.toString()]);
    expect(memberOneHistory.body.data.messages.map((message) => message._id)).toEqual([
      visibleMessage._id.toString(),
      hiddenMessage._id.toString(),
    ]);
  });
});
