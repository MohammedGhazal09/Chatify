import { afterEach, describe, expect, it } from 'vitest';
import Message from '../../Models/messageModel.mjs';
import User from '../../Models/userModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createMessage } from '../fixtures/messages.mjs';
import {
  connectSocketForSignup,
  connectSocketAsUser,
  emitWithAck,
  waitForSocketEvent,
} from '../helpers/socketClient.mjs';
import { startSocketTestServer } from '../helpers/socketServer.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

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
  it('re-emits canonical side effects while keeping duplicate creates single-copy', async () => {
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

    const duplicateMessagePromise = waitForSocketEvent(memberTwo.socket, 'message:new');
    const duplicateUnreadPromise = waitForSocketEvent(memberTwo.socket, 'unread:update');

    const retryResponse = await memberOne.agent
      .post('/api/message/new-message')
      .send(payload)
      .expect(200);
    const duplicateMessage = await duplicateMessagePromise;
    const duplicateUnread = await duplicateUnreadPromise;

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
    expect(duplicateMessage).toMatchObject({
      _id: createResponse.body.data.message._id,
      clientMessageId: payload.clientMessageId,
      chatId,
      sender: memberOne.user._id.toString(),
      text: payload.text,
      status: 'sent',
      deletedForEveryone: false,
    });
    expect(duplicateUnread).toEqual({
      chatId,
      userId: memberTwo.user._id.toString(),
      count: 1,
    });
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

  it('does not let the sender mark their own message delivered through the socket', async () => {
    const { memberOne, chat } = await setupRealtimeMessageScenario();
    const message = await createMessage({ chat, sender: memberOne.user, text: 'Sender delivery no-op' });
    const noStatusPromise = waitForNoSocketEvent(memberOne.socket, 'message:status-update');

    const ack = await emitWithAck(memberOne.socket, 'message:delivered', {
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
    expect(storedMessage.status).toBe('sent');
    expect(storedMessage.deliveredAt).toBeUndefined();
  });

  it('does not mark messages delivered during passive connection auto-join', async () => {
    await Message.init();

    const server = await startServer();
    const memberOneSignup = await signupWithAgent({ firstName: 'Passive', lastName: 'Sender' });
    const memberTwoSignup = await signupWithAgent({ firstName: 'Passive', lastName: 'Recipient' });
    const chat = await createDirectChat([memberOneSignup.user, memberTwoSignup.user]);
    const message = await createMessage({
      chat,
      sender: memberOneSignup.user,
      text: 'Passive join must not deliver',
    });

    const memberTwo = await connectSocketForSignup(server.url, memberTwoSignup);
    trackSocket(memberTwo.socket);

    const noStatusUpdate = await waitForNoSocketEvent(memberTwo.socket, 'message:status-update');
    const storedMessage = await Message.findById(message._id);

    expect(memberTwo.ready.joinedChats).toBeGreaterThanOrEqual(1);
    expect(noStatusUpdate).toBeUndefined();
    expect(storedMessage.status).toBe('sent');
    expect(storedMessage.deliveredAt).toBeUndefined();
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

  it('emits canonical edit and reaction payloads', async () => {
    const { memberOne, memberTwo, chat } = await setupRealtimeMessageScenario();
    const message = await createMessage({ chat, sender: memberOne.user, text: 'Before realtime edit' });
    const editPromise = waitForSocketEvent(memberTwo.socket, 'message:edited');

    const editResponse = await memberOne.agent
      .patch(`/api/message/${message._id}/edit`)
      .send({ text: 'After realtime edit' })
      .expect(200);
    const editEvent = await editPromise;
    const reactionPromise = waitForSocketEvent(memberOne.socket, 'message:reaction');

    const reactionResponse = await memberTwo.agent
      .post(`/api/message/${message._id}/reaction`)
      .send({ emoji: 'ok' })
      .expect(200);
    const reactionEvent = await reactionPromise;

    expect(editEvent).toMatchObject({
      messageId: message._id.toString(),
      text: 'After realtime edit',
      isEdited: true,
      message: {
        _id: message._id.toString(),
        text: 'After realtime edit',
        isEdited: true,
      },
    });
    expect(editEvent.message).toEqual(editResponse.body.data.message);
    expect(reactionEvent).toMatchObject({
      messageId: message._id.toString(),
      action: 'added',
      emoji: 'ok',
      userId: memberTwo.user._id.toString(),
      message: {
        _id: message._id.toString(),
        reactions: [
          {
            user: memberTwo.user._id.toString(),
            emoji: 'ok',
          },
        ],
      },
    });
    expect(reactionEvent.message).toEqual(reactionResponse.body.data.message);
  });

  it('emits canonical tombstones and absolute unread updates on delete-for-everyone', async () => {
    const { memberOne, memberTwo, chat, chatId } = await setupRealtimeMessageScenario();
    const message = await createMessage({ chat, sender: memberOne.user, text: 'Realtime tombstone' });
    const deletePromise = waitForSocketEvent(memberTwo.socket, 'message:deleted');
    const unreadPromise = waitForSocketEvent(memberTwo.socket, 'unread:update');

    const deleteResponse = await memberOne.agent
      .delete(`/api/message/${message._id}`)
      .send({ deleteForEveryone: true })
      .expect(200);
    const deleteEvent = await deletePromise;
    const unreadEvent = await unreadPromise;

    expect(deleteEvent).toMatchObject({
      messageId: message._id.toString(),
      text: '',
      deletedForEveryone: true,
      deletedBy: memberOne.user._id.toString(),
      message: {
        _id: message._id.toString(),
        text: '',
        deletedForEveryone: true,
      },
    });
    expect(deleteEvent.message).toEqual(deleteResponse.body.data.message);
    expect(unreadEvent).toEqual({
      chatId,
      userId: memberTwo.user._id.toString(),
      count: 0,
    });
  });

  it('emits canonical tombstones when moderation removes reported content', async () => {
    const { memberOne, memberTwo, chat, chatId } = await setupRealtimeMessageScenario();
    const message = await createMessage({ chat, sender: memberOne.user, text: 'Moderation tombstone' });
    const admin = await signupWithAgent({
      firstName: 'Socket',
      lastName: 'Admin',
      username: 'socket.admin',
    });
    await User.findByIdAndUpdate(admin.user._id, { role: 'admin' });

    const reportResponse = await memberTwo.agent
      .post('/api/moderation/reports')
      .send({
        targetType: 'message',
        messageId: message._id.toString(),
        reason: 'privacy',
      })
      .expect(201);
    const deletePromise = waitForSocketEvent(memberTwo.socket, 'message:deleted');
    const unreadPromise = waitForSocketEvent(memberTwo.socket, 'unread:update');

    await admin.agent
      .patch(`/api/moderation/reports/${reportResponse.body.data.report._id}/review`)
      .send({
        status: 'action_taken',
        moderationAction: 'content_removed',
        note: 'Remove reported content from active clients.',
      })
      .expect(200);

    const deleteEvent = await deletePromise;
    const unreadEvent = await unreadPromise;

    expect(deleteEvent).toMatchObject({
      messageId: message._id.toString(),
      text: '',
      deletedForEveryone: true,
      deletedBy: admin.user._id.toString(),
      moderationAction: 'content_removed',
      message: {
        _id: message._id.toString(),
        text: '',
        deletedForEveryone: true,
      },
    });
    expect(unreadEvent).toEqual({
      chatId,
      userId: memberTwo.user._id.toString(),
      count: 0,
    });
  });
});
