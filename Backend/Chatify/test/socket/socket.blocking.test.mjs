import { afterEach, describe, expect, it } from 'vitest';
import Message from '../../Models/messageModel.mjs';
import UserBlock from '../../Models/userBlockModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createMessage } from '../fixtures/messages.mjs';
import {
  connectSocketAsUser,
  emitWithAck,
} from '../helpers/socketClient.mjs';
import { startSocketTestServer } from '../helpers/socketServer.mjs';

const servers = [];
const sockets = [];

const waitForNoSocketEvent = (socket, eventName, timeoutMs = 250) => new Promise((resolve) => {
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

const startServer = async () => {
  const server = await startSocketTestServer();
  servers.push(server);
  return server;
};

const trackSocket = (socket) => {
  sockets.push(socket);
  return socket;
};

const setupBlockedSocketScenario = async () => {
  await UserBlock.init();
  await Message.init();

  const server = await startServer();
  const memberOne = await connectSocketAsUser(server.url, { firstName: 'Socket', lastName: 'Blocker' });
  const memberTwo = await connectSocketAsUser(server.url, { firstName: 'Socket', lastName: 'Blocked' });

  trackSocket(memberOne.socket);
  trackSocket(memberTwo.socket);

  const chat = await createDirectChat([memberOne.user, memberTwo.user]);
  const chatId = chat._id.toString();

  await emitWithAck(memberOne.socket, 'chat:join', chatId);
  await emitWithAck(memberTwo.socket, 'chat:join', chatId);
  const message = await createMessage({ chat, sender: memberOne.user, text: 'Blocked delivery test' });
  await memberOne.agent.post(`/api/chat/${chatId}/block`).expect(200);

  return { memberOne, memberTwo, chat, chatId, message };
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

describe('Socket.IO blocked conversation contract', () => {
  it('rejects typing events without notifying the blocked peer', async () => {
    const { memberOne, memberTwo, chatId } = await setupBlockedSocketScenario();
    const noTypingPromise = waitForNoSocketEvent(memberOne.socket, 'user:typing');

    const ack = await emitWithAck(memberTwo.socket, 'typing:start', { chatId });
    const typingEvent = await noTypingPromise;

    expect(ack).toMatchObject({
      ok: false,
      event: 'typing:start',
      code: 'conversation_blocked',
    });
    expect(typingEvent).toBeUndefined();
  });

  it('rejects delivery receipts without mutating message status', async () => {
    const { memberOne, memberTwo, message } = await setupBlockedSocketScenario();
    const noStatusPromise = waitForNoSocketEvent(memberOne.socket, 'message:status-update');

    const ack = await emitWithAck(memberTwo.socket, 'message:delivered', {
      messageId: message._id.toString(),
    });
    const statusEvent = await noStatusPromise;
    const storedMessage = await Message.findById(message._id);

    expect(ack).toMatchObject({
      ok: false,
      event: 'message:delivered',
      code: 'conversation_blocked',
    });
    expect(statusEvent).toBeUndefined();
    expect(storedMessage.status).toBe('sent');
    expect(storedMessage.deliveredAt).toBeUndefined();
  });

  it('does not mark messages delivered during blocked chat join', async () => {
    const { memberOne, memberTwo, chatId, message } = await setupBlockedSocketScenario();
    const noStatusPromise = waitForNoSocketEvent(memberOne.socket, 'message:status-update');

    const joinAck = await emitWithAck(memberTwo.socket, 'chat:join', chatId);
    const statusEvent = await noStatusPromise;
    const storedMessage = await Message.findById(message._id);

    expect(joinAck).toMatchObject({
      ok: true,
      event: 'chat:join',
      chatId,
    });
    expect(statusEvent).toBeUndefined();
    expect(storedMessage.status).toBe('sent');
  });
});
