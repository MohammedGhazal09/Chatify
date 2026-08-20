import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createMessage } from '../fixtures/messages.mjs';
import { attachText, attachVoice } from '../fixtures/attachments.mjs';
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

const tinyPngBuffer = () => Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

const searchMessages = (agent, chatId, queryOrOptions, limit) => {
  const options = typeof queryOrOptions === 'object'
    ? queryOrOptions
    : { q: queryOrOptions };
  const searchParams = new URLSearchParams();

  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  });

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

const createVoiceMessage = (agent, chatId, clientMessageId, filename = 'daily-note.webm') => (
  attachVoice(
    agent
      .post('/api/message/new-message')
      .field('chatId', chatId)
      .field('text', 'voice metadata only')
      .field('clientMessageId', clientMessageId),
    { filename, text: 'voice hidden body' }
  )
);

const createMediaMessage = (agent, chatId, clientMessageId, filename = 'launch-photo.png') => (
  agent
    .post('/api/message/new-message')
    .field('chatId', chatId)
    .field('text', 'media metadata only')
    .field('clientMessageId', clientMessageId)
    .attach('attachments', tinyPngBuffer(), {
      filename,
      contentType: 'image/png',
    })
);

describe('selected chat message search', () => {
  it('rejects invalid, short, and non-member searches safely', async () => {
    const { memberOne, outsider, chat } = await setupSearchScenario();

    const invalidChat = await searchMessages(memberOne.agent, 'not-a-chat-id', 'alpha').expect(400);
    const shortQuery = await searchMessages(memberOne.agent, chat._id, ' a ').expect(400);
    const unboundedEmptyQuery = await searchMessages(memberOne.agent, chat._id, {}).expect(400);
    const invalidType = await searchMessages(memberOne.agent, chat._id, { type: 'private' }).expect(400);
    const invalidDate = await searchMessages(memberOne.agent, chat._id, { from: 'not-a-date', type: 'text' }).expect(400);
    const outsiderResponse = await searchMessages(outsider.agent, chat._id, 'alpha').expect(403);

    expect(invalidChat.body.message).toMatch(/invalid chat id/i);
    expect(shortQuery.body.message).toMatch(/at least 2 characters/i);
    expect(unboundedEmptyQuery.body.message).toMatch(/at least 2 characters or include a filter/i);
    expect(invalidType.body.message).toMatch(/invalid message search type/i);
    expect(invalidDate.body.message).toMatch(/invalid from date/i);
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

  it('filters results by sender, date range, and message type', async () => {
    const { memberOne, memberTwo, chat } = await setupSearchScenario();

    await createTimedMessage({ chat, sender: memberOne.user, text: 'roadmap sender mismatch', index: 1 });
    const expected = await createTimedMessage({ chat, sender: memberTwo.user, text: 'roadmap target inside range', index: 3 });
    await createTimedMessage({ chat, sender: memberTwo.user, text: 'roadmap outside range', index: 5 });

    const response = await searchMessages(memberOne.agent, chat._id, {
      q: 'roadmap',
      senderId: memberTwo.user._id.toString(),
      from: '2026-06-09T10:02:00.000Z',
      to: '2026-06-09T10:04:00.000Z',
      type: 'text',
    }).expect(200);

    expect(response.body.data.filters).toMatchObject({
      query: 'roadmap',
      senderId: memberTwo.user._id.toString(),
      type: 'text',
    });
    expect(response.body.data.messages.map((message) => message._id)).toEqual([expected._id.toString()]);
    expect(response.body.data.messages[0].searchMatch).toMatchObject({
      kind: 'text',
      label: 'Message text',
    });
  });

  it('filters links and active attachment kinds without searching file contents', async () => {
    const { memberOne, memberTwo, chat } = await setupSearchScenario();

    const link = await createTimedMessage({
      chat,
      sender: memberOne.user,
      text: 'Launch notes live at https://example.test/launch',
      index: 1,
    });
    const file = await createAttachmentMessage(
      memberOne.agent,
      chat._id.toString(),
      'advanced-search-file',
      'socket-plan-notes.txt',
      'hidden body phrase'
    ).expect(201);
    const voice = await createVoiceMessage(
      memberOne.agent,
      chat._id.toString(),
      'advanced-search-voice',
      'daily-note.webm'
    ).expect(201);
    const media = await createMediaMessage(
      memberOne.agent,
      chat._id.toString(),
      'advanced-search-media',
      'launch-photo.png'
    ).expect(201);

    const linkResponse = await searchMessages(memberTwo.agent, chat._id, { type: 'link' }).expect(200);
    const fileResponse = await searchMessages(memberTwo.agent, chat._id, { type: 'file', q: 'socket-plan' }).expect(200);
    const fileContentResponse = await searchMessages(memberTwo.agent, chat._id, { type: 'file', q: 'hidden body' }).expect(200);
    const voiceResponse = await searchMessages(memberTwo.agent, chat._id, { type: 'voice' }).expect(200);
    const mediaResponse = await searchMessages(memberTwo.agent, chat._id, { type: 'media' }).expect(200);

    expect(linkResponse.body.data.messages.map((message) => message._id)).toEqual([link._id.toString()]);
    expect(linkResponse.body.data.messages[0].searchMatch).toMatchObject({
      kind: 'link',
      text: 'https://example.test/launch',
    });
    expect(fileResponse.body.data.messages.map((message) => message._id)).toEqual([
      file.body.data.message._id,
    ]);
    expect(fileResponse.body.data.messages[0].searchMatch).toMatchObject({
      kind: 'file',
      attachmentName: 'socket-plan-notes.txt',
    });
    expect(fileContentResponse.body.data.messages).toEqual([]);
    expect(voiceResponse.body.data.messages.map((message) => message._id)).toEqual([
      voice.body.data.message._id,
    ]);
    expect(mediaResponse.body.data.messages.map((message) => message._id)).toEqual([
      media.body.data.message._id,
    ]);
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

  it('returns an authorized message context window for unloaded result jumps', async () => {
    const { memberOne, memberTwo, outsider, chat } = await setupSearchScenario();
    const createdMessages = [];

    for (let index = 1; index <= 7; index += 1) {
      createdMessages.push(await createTimedMessage({
        chat,
        sender: index % 2 === 0 ? memberTwo.user : memberOne.user,
        text: `context message ${index}`,
        index,
      }));
    }

    const target = createdMessages[3];
    const response = await memberOne.agent
      .get(`/api/message/context/${chat._id}/${target._id}?limit=5`)
      .expect(200);
    const outsiderResponse = await outsider.agent
      .get(`/api/message/context/${chat._id}/${target._id}`)
      .expect(403);

    expect(response.body.data.targetMessageId).toBe(target._id.toString());
    expect(response.body.data.messages.map((message) => message.text)).toEqual([
      'context message 2',
      'context message 3',
      'context message 4',
      'context message 5',
      'context message 6',
    ]);
    expect(response.body.data.cursor).toMatchObject({
      hasMore: true,
      limit: 5,
    });
    expect(response.body.data.cursor.nextCursor).toEqual(expect.any(String));
    expect(response.body.data.context).toMatchObject({
      hasMoreBefore: true,
      hasMoreAfter: true,
      limit: 5,
    });
    expect(outsiderResponse.body.message).toMatch(/forbidden or not found/i);
  });
});
