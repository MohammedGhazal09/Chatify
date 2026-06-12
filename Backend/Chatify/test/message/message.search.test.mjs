import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createMessage } from '../fixtures/messages.mjs';
import { attachText } from '../fixtures/attachments.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const setupSearchScenario = async () => {
  const memberOne = await signupWithAgent({ firstName: 'Search', lastName: 'One' });
  const memberTwo = await signupWithAgent({ firstName: 'Search', lastName: 'Two' });
  const outsider = await signupWithAgent({ firstName: 'Search', lastName: 'Outsider' });
  const chat = await createDirectChat([memberOne.user, memberTwo.user]);

  return { memberOne, memberTwo, outsider, chat };
};

const createTimedMessage = async ({ chat, sender, text, index }) => {
  const timestamp = new Date(Date.UTC(2026, 5, 9, 10, index, 0));

  return createMessage({
    chat,
    sender,
    text,
    overrides: {
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  });
};

const searchMessages = (agent, chatId, query, limit) => {
  const searchParams = new URLSearchParams({ q: query });

  if (limit !== undefined) {
    searchParams.set('limit', String(limit));
  }

  return agent.get(`/api/message/search/${chatId}?${searchParams.toString()}`);
};

const createAttachmentMessage = (agent, chatId, clientMessageId, filename, textContent) => (
  attachText(
    agent
      .post('/api/message/new-message')
      .field('chatId', chatId)
      .field('text', 'attachment metadata only')
      .field('clientMessageId', clientMessageId),
    filename,
    textContent
  )
);

describe('selected chat message search', () => {
  it('rejects invalid, short, and non-member searches safely', async () => {
    const { memberOne, outsider, chat } = await setupSearchScenario();

    const invalidChat = await searchMessages(memberOne.agent, 'not-a-chat-id', 'alpha').expect(400);
    const shortQuery = await searchMessages(memberOne.agent, chat._id, ' a ').expect(400);
    const outsiderResponse = await searchMessages(outsider.agent, chat._id, 'alpha').expect(403);

    expect(invalidChat.body.message).toMatch(/invalid chat id/i);
    expect(shortQuery.body.message).toMatch(/at least 2 characters/i);
    expect(outsiderResponse.body.message).toMatch(/forbidden or not found/i);
  });

  it('returns canonical visible results newest-first from the selected chat only', async () => {
    const { memberOne, memberTwo, chat } = await setupSearchScenario();

    await createTimedMessage({ chat, sender: memberOne.user, text: 'alpha older match', index: 1 });
    const newestMatch = await createTimedMessage({ chat, sender: memberTwo.user, text: 'ALPHA newest match', index: 3 });
    await createTimedMessage({ chat, sender: memberTwo.user, text: 'unrelated text', index: 4 });
    const olderMatch = await createTimedMessage({ chat, sender: memberOne.user, text: 'alpha middle match', index: 2 });

    const response = await searchMessages(memberOne.agent, chat._id, ' alpha ').expect(200);

    expect(response.body.data.messages.map((message) => message._id)).toEqual([
      newestMatch._id.toString(),
      olderMatch._id.toString(),
      expect.any(String),
    ]);
    expect(response.body.data.messages[0]).toMatchObject({
      _id: newestMatch._id.toString(),
      chatId: chat._id.toString(),
      sender: memberTwo.user._id.toString(),
      text: 'ALPHA newest match',
      status: 'sent',
      reactions: [],
      deletedForEveryone: false,
    });
  });

  it('treats regex metacharacters as literal search text', async () => {
    const { memberOne, chat } = await setupSearchScenario();

    const literal = await createTimedMessage({
      chat,
      sender: memberOne.user,
      text: 'Find literal a.b? marker',
      index: 1,
    });
    await createTimedMessage({
      chat,
      sender: memberOne.user,
      text: 'Find similar axb marker',
      index: 2,
    });

    const response = await searchMessages(memberOne.agent, chat._id, 'a.b?').expect(200);

    expect(response.body.data.messages.map((message) => message._id)).toEqual([literal._id.toString()]);
  });

  it('excludes requester-hidden messages and deleted-for-everyone tombstones', async () => {
    const { memberOne, memberTwo, chat } = await setupSearchScenario();

    const visible = await createTimedMessage({
      chat,
      sender: memberOne.user,
      text: 'secret visible result',
      index: 1,
    });
    const hiddenForRequester = await createTimedMessage({
      chat,
      sender: memberOne.user,
      text: 'secret hidden for requester',
      index: 2,
    });
    const tombstone = await createTimedMessage({
      chat,
      sender: memberOne.user,
      text: 'secret tombstone text',
      index: 3,
    });

    await memberTwo.agent
      .delete(`/api/message/${hiddenForRequester._id}`)
      .send({ deleteForEveryone: false })
      .expect(200);
    await memberOne.agent
      .delete(`/api/message/${tombstone._id}`)
      .send({ deleteForEveryone: true })
      .expect(200);

    const response = await searchMessages(memberTwo.agent, chat._id, 'secret').expect(200);

    expect(response.body.data.messages.map((message) => message._id)).toEqual([visible._id.toString()]);
  });

  it('caps results at 25 even when a larger limit is requested', async () => {
    const { memberOne, chat } = await setupSearchScenario();

    for (let index = 1; index <= 30; index += 1) {
      await createTimedMessage({
        chat,
        sender: memberOne.user,
        text: `cap target ${String(index).padStart(2, '0')}`,
        index,
      });
    }

    const response = await searchMessages(memberOne.agent, chat._id, 'cap target', 99).expect(200);

    expect(response.body.data.limit).toBe(25);
    expect(response.body.data.messages).toHaveLength(25);
    expect(response.body.data.messages[0].text).toBe('cap target 30');
    expect(response.body.data.messages.at(-1).text).toBe('cap target 06');
  });

  it('does not return messages from a different selected chat', async () => {
    const { memberOne, memberTwo, chat } = await setupSearchScenario();
    const otherChat = await createDirectChat([memberOne.user, memberTwo.user], {
      members: [memberOne.user._id, new mongoose.Types.ObjectId()],
    });

    await createTimedMessage({ chat, sender: memberOne.user, text: 'scope visible here', index: 1 });
    await createTimedMessage({ chat: otherChat, sender: memberOne.user, text: 'scope other chat', index: 2 });

    const response = await searchMessages(memberOne.agent, chat._id, 'scope').expect(200);

    expect(response.body.data.messages.map((message) => message.text)).toEqual(['scope visible here']);
  });

  it('searches attachment filenames as metadata without searching file contents', async () => {
    const { memberOne, memberTwo, chat } = await setupSearchScenario();

    const created = await createAttachmentMessage(
      memberOne.agent,
      chat._id.toString(),
      'metadata-search-file',
      'socket-plan-notes.txt',
      'hidden body phrase'
    ).expect(201);

    const filenameResponse = await searchMessages(memberTwo.agent, chat._id, 'socket-plan').expect(200);
    const contentResponse = await searchMessages(memberTwo.agent, chat._id, 'hidden body').expect(200);

    expect(filenameResponse.body.data.messages.map((message) => message._id)).toEqual([
      created.body.data.message._id,
    ]);
    expect(contentResponse.body.data.messages).toEqual([]);
  });
});
