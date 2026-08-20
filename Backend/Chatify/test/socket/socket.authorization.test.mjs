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

const setupRealtimeScenario = async () => {
  const server = await startServer();
  const memberOne = await connectSocketAsUser(server.url, { firstName: 'Member', lastName: 'One' });
  const memberTwo = await connectSocketAsUser(server.url, { firstName: 'Member', lastName: 'Two' });
  const outsider = await connectSocketAsUser(server.url, { firstName: 'Outside', lastName: 'User' });

  trackSocket(memberOne.socket);
  trackSocket(memberTwo.socket);
  trackSocket(outsider.socket);

  const chat = await createDirectChat([memberOne.user, memberTwo.user]);
  const chatId = chat._id.toString();

  await emitWithAck(memberOne.socket, 'chat:join', chatId);
  await emitWithAck(memberTwo.socket, 'chat:join', chatId);

  return { memberOne, memberTwo, outsider, chat, chatId };
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

describe('Socket.IO chat authorization', () => {
  it('allows chat members to join and emit typing events to the room', async () => {
    const { memberOne, memberTwo, chatId } = await setupRealtimeScenario();
    const typingPromise = waitForSocketEvent(memberTwo.socket, 'user:typing');

    const response = await emitWithAck(memberOne.socket, 'typing:start', { chatId });
    const typing = await typingPromise;

    expect(response).toMatchObject({ ok: true, event: 'typing:start', chatId });
    expect(typing).toMatchObject({
      chatId,
      userId: memberOne.user._id.toString(),
      userName: 'Member One',
      isTyping: true,
    });
  });

  it('rejects non-members from joining another chat room', async () => {
    const { outsider, chatId } = await setupRealtimeScenario();

    const response = await emitWithAck(outsider.socket, 'chat:join', chatId);

    expect(response).toMatchObject({
      ok: false,
      event: 'chat:join',
      code: 'forbidden_or_not_found',
      message: 'Forbidden or not found',
    });
  });

  it('rate limits repeated DB-backed socket events with structured errors', async () => {
    const { memberOne, chatId } = await setupRealtimeScenario();
    let response;

    for (let attempt = 0; attempt < 25; attempt += 1) {
      response = await emitWithAck(memberOne.socket, 'chat:join', chatId);
    }

    expect(response).toMatchObject({
      ok: false,
      event: 'chat:join',
      code: 'rate_limited',
      message: 'Too many socket events',
    });
  });

  it('rejects unauthorized typing with socket:error fallback and no room broadcast', async () => {
    const { outsider, memberTwo, chatId } = await setupRealtimeScenario();
    const errorPromise = waitForSocketEvent(outsider.socket, 'socket:error');
    const noTypingPromise = waitForNoSocketEvent(memberTwo.socket, 'user:typing');

    outsider.socket.emit('typing:start', { chatId });

    const error = await errorPromise;
    const typing = await noTypingPromise;

    expect(error).toMatchObject({
      ok: false,
      event: 'typing:start',
      code: 'forbidden_or_not_found',
    });
    expect(typing).toBeUndefined();
  });

  it('rejects unauthorized delivery updates and derives chat from the stored message', async () => {
    const { outsider, memberOne, chat } = await setupRealtimeScenario();
    const message = await createMessage({ chat, sender: memberOne.user });

    const response = await emitWithAck(outsider.socket, 'message:delivered', {
      messageId: message._id.toString(),
      chatId: '507f1f77bcf86cd799439011',
    });
    const storedMessage = await Message.findById(message._id);

    expect(response).toMatchObject({
      ok: false,
      event: 'message:delivered',
      code: 'forbidden_or_not_found',
    });
    expect(storedMessage.status).toBe('sent');
  });

  it('allows authorized delivery updates using the stored message chat', async () => {
    const { memberOne, memberTwo, chat } = await setupRealtimeScenario();
    const message = await createMessage({ chat, sender: memberOne.user });
    const statusPromise = waitForSocketEvent(memberOne.socket, 'message:status-update');

    const response = await emitWithAck(memberTwo.socket, 'message:delivered', {
      messageId: message._id.toString(),
      chatId: '507f1f77bcf86cd799439011',
    });
    const statusUpdate = await statusPromise;
    const storedMessage = await Message.findById(message._id);

    expect(response).toMatchObject({
      ok: true,
      event: 'message:delivered',
      messageId: message._id.toString(),
    });
    expect(statusUpdate).toMatchObject({
      messageId: message._id.toString(),
      status: 'delivered',
    });
    expect(storedMessage.status).toBe('delivered');
  });

  it('rejects direct socket message sends without broadcasting arbitrary messages', async () => {
    const { memberOne, memberTwo, chatId } = await setupRealtimeScenario();
    const noMessagePromise = waitForNoSocketEvent(memberTwo.socket, 'message:new');

    const response = await emitWithAck(memberOne.socket, 'message:send', {
      chatId,
      message: { _id: 'client-forged-message', text: 'Forged socket message' },
    });
    const message = await noMessagePromise;

    expect(response).toMatchObject({
      ok: false,
      event: 'message:send',
      code: 'deprecated_socket_message_send',
    });
    expect(message).toBeUndefined();
  });

  it('targets unread updates only to the intended recipient sockets', async () => {
    const { memberOne, memberTwo, chatId } = await setupRealtimeScenario();
    const recipientUnreadPromise = waitForSocketEvent(memberTwo.socket, 'unread:update');
    const senderUnreadPromise = waitForNoSocketEvent(memberOne.socket, 'unread:update');

    await memberOne.agent
      .post('/api/message/new-message')
      .send({
        chatId,
        text: 'Unread target check',
        clientMessageId: 'socket-unread-target-check',
      })
      .expect(201);

    const recipientUnread = await recipientUnreadPromise;
    const senderUnread = await senderUnreadPromise;

    expect(recipientUnread).toMatchObject({
      chatId,
      userId: memberTwo.user._id.toString(),
      count: 1,
    });
    expect(senderUnread).toBeUndefined();
  });
});
