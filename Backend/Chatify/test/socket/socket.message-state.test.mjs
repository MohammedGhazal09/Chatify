import { afterEach, describe, expect, it } from 'vitest';
import Message from '../../Models/messageModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createMessage } from '../fixtures/messages.mjs';
import {
  connectSocketAsUser,
  emitWithAck,
  waitForSocketEvent,
} from '../helpers/socketClient.mjs';
import { startSocketTestServer } from '../helpers/socketServer.mjs';

const servers = [];
const sockets = [];

const startServer = async () => {
  const server = await startSocketTestServer();
  servers.push(server);
  return server;
};

const trackSocket = (socket) => {
  sockets.push(socket);
  return socket;
};

const waitForNoSocketEvent = (socket, eventName, timeoutMs = 250) => {
  return new Promise((resolve) => {
    let payload;

    const onEvent = (eventPayload) => {
      payload = eventPayload;
    };

    socket.once(eventName, onEvent);

    setTimeout(() => {
      socket.off(eventName, onEvent);
      resolve(payload);
    }, timeoutMs);
  });
};

const setupRealtimeMessageScenario = async () => {
  await Message.init();

  const server = await startServer();
  const memberOne = await connectSocketAsUser(server.url, { firstName: 'Member', lastName: 'One' });
  const memberTwo = await connectSocketAsUser(server.url, { firstName: 'Member', lastName: 'Two' });

  trackSocket(memberOne.socket);
  trackSocket(memberTwo.socket);

  const chat = await createDirectChat([memberOne.user, memberTwo.user]);
  const chatId = chat._id.toString();

  await emitWithAck(memberOne.socket, 'chat:join', chatId);
  await emitWithAck(memberTwo.socket, 'chat:join', chatId);

  return { memberOne, memberTwo, chat, chatId };
};

afterEach(async () => {
  sockets.splice(0).forEach((socket) => {
    if (socket.connected || socket.active) {
      socket.disconnect();
    }
  });

  for (const server of servers.splice(0)) {
    await server.close();
  }
});

describe('Socket.IO message state contract', () => {
  it('emits one canonical new-message event and one absolute unread update for duplicate creates', async () => {
    const { memberOne, memberTwo, chat, chatId } = await setupRealtimeMessageScenario();
    const payload = {
      chatId,
      text: 'Realtime idempotency',
      clientMessageId: 'socket-client-message-1',
    };
    const newMessagePromise = waitForSocketEvent(memberTwo.socket, 'message:new');
    const unreadPromise = waitForSocketEvent(memberTwo.socket, 'unread:update');

    const createResponse = await memberOne.agent
      .post('/api/message/new-message')
      .send(payload)
      .expect(201);
    const newMessage = await newMessagePromise;
    const unread = await unreadPromise;

    const noDuplicateMessagePromise = waitForNoSocketEvent(memberTwo.socket, 'message:new');
    const noDuplicateUnreadPromise = waitForNoSocketEvent(memberTwo.socket, 'unread:update');

    const retryResponse = await memberOne.agent
      .post('/api/message/new-message')
      .send(payload)
      .expect(200);
    const duplicateMessage = await noDuplicateMessagePromise;
    const duplicateUnread = await noDuplicateUnreadPromise;

    await expect(Message.countDocuments({
      chatId: chat._id,
      sender: memberOne.user._id,
      clientMessageId: payload.clientMessageId,
    })).resolves.toBe(1);
    expect(createResponse.body.data.message._id).toBe(retryResponse.body.data.message._id);
    expect(newMessage).toMatchObject({
      _id: createResponse.body.data.message._id,
      clientMessageId: payload.clientMessageId,
      chatId,
      sender: memberOne.user._id.toString(),
      text: payload.text,
      status: 'sent',
      deletedForEveryone: false,
    });
    expect(unread).toEqual({
      chatId,
      userId: memberTwo.user._id.toString(),
      count: 1,
    });
    expect(duplicateMessage).toBeUndefined();
    expect(duplicateUnread).toBeUndefined();
  });

  it('applies delivery once and preserves the first deliveredAt timestamp', async () => {
    const { memberOne, memberTwo, chat } = await setupRealtimeMessageScenario();
    const message = await createMessage({ chat, sender: memberOne.user, text: 'Deliver once' });
    const firstStatusPromise = waitForSocketEvent(memberOne.socket, 'message:status-update');

    const firstAck = await emitWithAck(memberTwo.socket, 'message:delivered', {
      messageId: message._id.toString(),
    });
    const firstStatus = await firstStatusPromise;
    const firstStoredMessage = await Message.findById(message._id);

    const noDuplicateStatusPromise = waitForNoSocketEvent(memberOne.socket, 'message:status-update');
    const secondAck = await emitWithAck(memberTwo.socket, 'message:delivered', {
      messageId: message._id.toString(),
    });
    const duplicateStatus = await noDuplicateStatusPromise;
    const secondStoredMessage = await Message.findById(message._id);

    expect(firstAck).toMatchObject({
      ok: true,
      event: 'message:delivered',
      messageId: message._id.toString(),
    });
    expect(secondAck).toMatchObject({
      ok: true,
      event: 'message:delivered',
      messageId: message._id.toString(),
    });
    expect(firstStatus).toMatchObject({
      messageId: message._id.toString(),
      status: 'delivered',
      deliveredAt: expect.any(String),
    });
    expect(firstStoredMessage.status).toBe('delivered');
    expect(duplicateStatus).toBeUndefined();
    expect(secondStoredMessage.status).toBe('delivered');
    expect(secondStoredMessage.deliveredAt.getTime()).toBe(firstStoredMessage.deliveredAt.getTime());
  });

  it('does not let delivery overwrite an already-read message', async () => {
    const { memberOne, memberTwo, chat } = await setupRealtimeMessageScenario();
    const deliveredAt = new Date('2026-01-01T00:00:00.000Z');
    const readAt = new Date('2026-01-01T00:00:01.000Z');
    const message = await createMessage({
      chat,
      sender: memberOne.user,
      text: 'Already read',
      overrides: {
        status: 'read',
        read: true,
        deliveredAt,
        readAt,
        readBy: [{ user: memberTwo.user._id, readAt }],
      },
    });
    const noStatusPromise = waitForNoSocketEvent(memberOne.socket, 'message:status-update');

    const ack = await emitWithAck(memberTwo.socket, 'message:delivered', {
      messageId: message._id.toString(),
    });
    const statusUpdate = await noStatusPromise;
    const storedMessage = await Message.findById(message._id);

    expect(ack).toMatchObject({
      ok: true,
      event: 'message:delivered',
      messageId: message._id.toString(),
    });
    expect(statusUpdate).toBeUndefined();
    expect(storedMessage.status).toBe('read');
    expect(storedMessage.deliveredAt.getTime()).toBe(deliveredAt.getTime());
    expect(storedMessage.readAt.getTime()).toBe(readAt.getTime());
  });
});
