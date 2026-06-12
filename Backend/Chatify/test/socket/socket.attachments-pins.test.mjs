import { afterEach, describe, expect, it } from 'vitest';
import Message from '../../Models/messageModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createMessage } from '../fixtures/messages.mjs';
import { attachText } from '../fixtures/attachments.mjs';
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

const setupAttachmentSocketScenario = async () => {
  await Message.init();

  const server = await startServer();
  const memberOne = await connectSocketAsUser(server.url, { firstName: 'Member', lastName: 'One' });
  const memberTwo = await connectSocketAsUser(server.url, { firstName: 'Member', lastName: 'Two' });
  const nonMember = await connectSocketAsUser(server.url, { firstName: 'Outside', lastName: 'User' });

  trackSocket(memberOne.socket);
  trackSocket(memberTwo.socket);
  trackSocket(nonMember.socket);

  const chat = await createDirectChat([memberOne.user, memberTwo.user]);
  const chatId = chat._id.toString();

  await emitWithAck(memberOne.socket, 'chat:join', chatId);
  await emitWithAck(memberTwo.socket, 'chat:join', chatId);

  return { memberOne, memberTwo, nonMember, chat, chatId };
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

describe('Socket.IO attachment and pin room contract', () => {
  it('emits attachment-bearing new messages only to chat-room members', async () => {
    const { memberOne, memberTwo, nonMember, chatId } = await setupAttachmentSocketScenario();
    const memberEventPromise = waitForSocketEvent(memberTwo.socket, 'message:new');
    const nonMemberEventPromise = waitForNoSocketEvent(nonMember.socket, 'message:new');

    const request = memberOne.agent
      .post('/api/message/new-message')
      .field('chatId', chatId)
      .field('text', '')
      .field('clientMessageId', 'socket-attachment-client-1');

    const response = await attachText(request, 'socket-attachment.txt', 'metadata only filename search').expect(201);
    const memberEvent = await memberEventPromise;
    const nonMemberEvent = await nonMemberEventPromise;

    expect(memberEvent).toMatchObject({
      _id: response.body.data.message._id,
      chatId,
      clientMessageId: 'socket-attachment-client-1',
      text: '',
      attachments: [
        expect.objectContaining({
          displayName: 'socket-attachment.txt',
          kind: 'file',
          status: 'active',
        }),
      ],
    });
    expect(nonMemberEvent).toBeUndefined();
  });

  it('emits pin and unpin events only to chat-room members', async () => {
    const { memberOne, memberTwo, nonMember, chat, chatId } = await setupAttachmentSocketScenario();
    const message = await createMessage({ chat, sender: memberOne.user, text: 'Pin room scoped' });
    const memberPinPromise = waitForSocketEvent(memberTwo.socket, 'message:pinned');
    const nonMemberPinPromise = waitForNoSocketEvent(nonMember.socket, 'message:pinned');

    const pinResponse = await memberOne.agent
      .post(`/api/message/${message._id}/pin`)
      .expect(200);
    const memberPinEvent = await memberPinPromise;
    const nonMemberPinEvent = await nonMemberPinPromise;

    expect(memberPinEvent).toMatchObject({
      chatId,
      messageId: message._id.toString(),
      message: {
        _id: message._id.toString(),
        pinned: true,
      },
      pinnedMessage: {
        messageId: message._id.toString(),
        pinned: true,
      },
    });
    expect(memberPinEvent.message).toEqual(pinResponse.body.data.message);
    expect(nonMemberPinEvent).toBeUndefined();

    const memberUnpinPromise = waitForSocketEvent(memberTwo.socket, 'message:unpinned');
    const nonMemberUnpinPromise = waitForNoSocketEvent(nonMember.socket, 'message:unpinned');

    const unpinResponse = await memberOne.agent
      .delete(`/api/message/${message._id}/pin`)
      .expect(200);
    const memberUnpinEvent = await memberUnpinPromise;
    const nonMemberUnpinEvent = await nonMemberUnpinPromise;

    expect(memberUnpinEvent).toMatchObject({
      chatId,
      messageId: message._id.toString(),
      message: {
        _id: message._id.toString(),
        pinned: false,
      },
      pinnedMessage: {
        messageId: message._id.toString(),
        pinned: false,
      },
    });
    expect(memberUnpinEvent.message).toEqual(unpinResponse.body.data.message);
    expect(nonMemberUnpinEvent).toBeUndefined();
  });
});
