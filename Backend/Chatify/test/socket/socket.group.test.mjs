import { afterEach, describe, expect, it } from 'vitest';
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

const setupGroupSocketScenario = async () => {
  const server = await startServer();
  const owner = await connectSocketAsUser(server.url, { firstName: 'SocketGroup', lastName: 'Owner' });
  const memberTwo = await connectSocketAsUser(server.url, { firstName: 'SocketGroup', lastName: 'Two' });
  const memberThree = await connectSocketAsUser(server.url, { firstName: 'SocketGroup', lastName: 'Three' });
  const outsider = await connectSocketAsUser(server.url, { firstName: 'SocketGroup', lastName: 'Outsider' });

  [owner, memberTwo, memberThree, outsider].forEach(({ socket }) => trackSocket(socket));

  const groupResponse = await owner.agent
    .post('/api/chat/create-group-chat')
    .send({
      chatName: 'Socket Group',
      memberUsernames: [memberTwo.user.username, memberThree.user.username],
    })
    .expect(201);
  const chatId = groupResponse.body.data.chat._id;

  await emitWithAck(owner.socket, 'chat:join', chatId);
  await emitWithAck(memberTwo.socket, 'chat:join', chatId);
  await emitWithAck(memberThree.socket, 'chat:join', chatId);

  return { owner, memberTwo, memberThree, outsider, chatId };
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

describe('group socket behavior', () => {
  it('allows group members to join and broadcasts typing only inside the group room', async () => {
    const { owner, memberTwo, memberThree, outsider, chatId } = await setupGroupSocketScenario();
    const memberTwoTypingPromise = waitForSocketEvent(memberTwo.socket, 'user:typing');
    const memberThreeTypingPromise = waitForSocketEvent(memberThree.socket, 'user:typing');
    const outsiderTypingPromise = waitForNoSocketEvent(outsider.socket, 'user:typing');

    const joinAck = await emitWithAck(outsider.socket, 'chat:join', chatId);
    const typingAck = await emitWithAck(owner.socket, 'typing:start', { chatId });
    const memberTwoTyping = await memberTwoTypingPromise;
    const memberThreeTyping = await memberThreeTypingPromise;
    const outsiderTyping = await outsiderTypingPromise;

    expect(joinAck).toMatchObject({
      ok: false,
      event: 'chat:join',
      code: 'forbidden_or_not_found',
    });
    expect(typingAck).toMatchObject({ ok: true, event: 'typing:start', chatId });
    expect(memberTwoTyping).toMatchObject({
      chatId,
      userId: owner.user._id.toString(),
      username: owner.user.username,
      isTyping: true,
    });
    expect(memberThreeTyping).toMatchObject({
      chatId,
      userId: owner.user._id.toString(),
      username: owner.user.username,
      isTyping: true,
    });
    expect(outsiderTyping).toBeUndefined();
  });

  it('delivers new group messages to joined members but not outsiders', async () => {
    const { owner, memberTwo, memberThree, outsider, chatId } = await setupGroupSocketScenario();
    const memberTwoMessagePromise = waitForSocketEvent(memberTwo.socket, 'message:new');
    const memberThreeMessagePromise = waitForSocketEvent(memberThree.socket, 'message:new');
    const outsiderMessagePromise = waitForNoSocketEvent(outsider.socket, 'message:new');

    await owner.agent
      .post('/api/message/new-message')
      .send({
        chatId,
        text: 'Realtime group delivery',
        clientMessageId: 'realtime-group-delivery',
      })
      .expect(201);

    const memberTwoMessage = await memberTwoMessagePromise;
    const memberThreeMessage = await memberThreeMessagePromise;
    const outsiderMessage = await outsiderMessagePromise;

    expect(memberTwoMessage).toMatchObject({
      chatId,
      text: 'Realtime group delivery',
      sender: owner.user._id.toString(),
    });
    expect(memberThreeMessage).toMatchObject({
      chatId,
      text: 'Realtime group delivery',
      sender: owner.user._id.toString(),
    });
    expect(outsiderMessage).toBeUndefined();
    expect(JSON.stringify(memberTwoMessage)).not.toContain('"email"');
    expect(JSON.stringify(memberThreeMessage)).not.toContain('"email"');
  });
});
