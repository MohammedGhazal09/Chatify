import { afterEach, describe, expect, it } from 'vitest';
import Chats from '../../Models/chatModel.mjs';
import Spaces from '../../Models/spaceModel.mjs';
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

const waitForNoSocketEvent = (socket, eventName, timeoutMs = 250) => (
  new Promise((resolve) => {
    let payload;

    const onEvent = (eventPayload) => {
      payload = eventPayload;
    };

    socket.once(eventName, onEvent);

    setTimeout(() => {
      socket.off(eventName, onEvent);
      resolve(payload);
    }, timeoutMs);
  })
);

const setupSpaceSocketUsers = async () => {
  await Spaces.init();
  await Chats.init();

  const server = await startServer();
  const owner = await connectSocketAsUser(server.url, { firstName: 'Socket', lastName: 'Owner' });
  const member = await connectSocketAsUser(server.url, { firstName: 'Socket', lastName: 'Member' });
  const outsider = await connectSocketAsUser(server.url, { firstName: 'Socket', lastName: 'Outsider' });

  trackSocket(owner.socket);
  trackSocket(member.socket);
  trackSocket(outsider.socket);

  return { owner, member, outsider };
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

describe('space channel socket contract', () => {
  it('emits space and channel realtime events only to authorized members', async () => {
    const { owner, member, outsider } = await setupSpaceSocketUsers();
    const memberSpacePromise = waitForSocketEvent(member.socket, 'space:new');
    const outsiderSpacePromise = waitForNoSocketEvent(outsider.socket, 'space:new');

    const created = await owner.agent
      .post('/api/space')
      .send({
        name: 'Realtime Space',
        memberUsernames: [member.user.username],
      })
      .expect(201);
    const spaceId = created.body.data.space._id;
    const channelId = created.body.data.channel._id;
    const memberSpaceEvent = await memberSpacePromise;
    const outsiderSpaceEvent = await outsiderSpacePromise;

    expect(memberSpaceEvent).toMatchObject({
      _id: spaceId,
      name: 'Realtime Space',
    });
    expect(outsiderSpaceEvent).toBeUndefined();

    const memberTypingPromise = waitForSocketEvent(member.socket, 'user:typing');
    const outsiderTypingPromise = waitForNoSocketEvent(outsider.socket, 'user:typing');
    const typingAck = await emitWithAck(owner.socket, 'typing:start', { chatId: channelId });
    const memberTyping = await memberTypingPromise;
    const outsiderTyping = await outsiderTypingPromise;

    expect(typingAck).toMatchObject({
      ok: true,
      event: 'typing:start',
      chatId: channelId,
    });
    expect(memberTyping).toMatchObject({
      chatId: channelId,
      userId: owner.user._id.toString(),
      isTyping: true,
    });
    expect(outsiderTyping).toBeUndefined();

    const memberMessagePromise = waitForSocketEvent(member.socket, 'message:new');
    const memberUnreadPromise = waitForSocketEvent(member.socket, 'unread:update');
    const outsiderMessagePromise = waitForNoSocketEvent(outsider.socket, 'message:new');
    const outsiderUnreadPromise = waitForNoSocketEvent(outsider.socket, 'unread:update');
    const messageResponse = await owner.agent
      .post('/api/message/new-message')
      .send({
        chatId: channelId,
        text: 'Realtime channel message',
        clientMessageId: 'space-socket-message-1',
      })
      .expect(201);
    const memberMessage = await memberMessagePromise;
    const memberUnread = await memberUnreadPromise;
    const outsiderMessage = await outsiderMessagePromise;
    const outsiderUnread = await outsiderUnreadPromise;

    expect(memberMessage).toMatchObject({
      _id: messageResponse.body.data.message._id,
      chatId: channelId,
      sender: owner.user._id.toString(),
      text: 'Realtime channel message',
    });
    expect(memberUnread).toMatchObject({
      chatId: channelId,
      userId: member.user._id.toString(),
      count: 1,
    });
    expect(outsiderMessage).toBeUndefined();
    expect(outsiderUnread).toBeUndefined();

    const outsiderJoinAck = await emitWithAck(outsider.socket, 'chat:join', channelId);
    expect(outsiderJoinAck).toMatchObject({
      ok: false,
      event: 'chat:join',
      code: 'forbidden_or_not_found',
    });

    const removedPromise = waitForSocketEvent(member.socket, 'space:removed');
    await owner.agent
      .delete(`/api/space/${spaceId}/members/${member.user._id}`)
      .expect(200);
    const removedEvent = await removedPromise;

    expect(removedEvent).toMatchObject({ spaceId });

    const removedMemberTypingPromise = waitForNoSocketEvent(member.socket, 'user:typing');
    const ownerTypingAck = await emitWithAck(owner.socket, 'typing:start', { chatId: channelId });
    const removedMemberTyping = await removedMemberTypingPromise;
    const removedMemberJoinAck = await emitWithAck(member.socket, 'chat:join', channelId);

    expect(ownerTypingAck).toMatchObject({ ok: true, event: 'typing:start' });
    expect(removedMemberTyping).toBeUndefined();
    expect(removedMemberJoinAck).toMatchObject({
      ok: false,
      event: 'chat:join',
      code: 'forbidden_or_not_found',
    });
  });
});
