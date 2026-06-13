import { afterEach, describe, expect, it } from 'vitest';
import CallSession from '../../Models/callSessionModel.mjs';
import Message from '../../Models/messageModel.mjs';
import UserBlock from '../../Models/userBlockModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
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

const setupBlockingCallScenario = async () => {
  await CallSession.init();
  await Message.init();
  await UserBlock.init();

  const server = await startServer();
  const memberOne = await connectSocketAsUser(server.url, { firstName: 'Block', lastName: 'Caller' });
  const memberTwo = await connectSocketAsUser(server.url, { firstName: 'Block', lastName: 'Callee' });

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

describe('Socket.IO call blocking contract', () => {
  it('rejects call starts when either direct-chat participant has blocked the conversation', async () => {
    const { memberOne, memberTwo, chatId } = await setupBlockingCallScenario();

    await memberOne.agent.post(`/api/chat/${chatId}/block`).expect(200);

    const callerAck = await emitWithAck(memberOne.socket, 'call:start', {
      chatId,
      mode: 'audio',
    });
    const calleeAck = await emitWithAck(memberTwo.socket, 'call:start', {
      chatId,
      mode: 'audio',
    });

    expect(callerAck).toMatchObject({
      ok: false,
      event: 'call:start',
      code: 'conversation_blocked',
    });
    expect(calleeAck).toMatchObject({
      ok: false,
      event: 'call:start',
      code: 'conversation_blocked',
    });
    await expect(CallSession.countDocuments({ chatId })).resolves.toBe(0);
  });

  it('ends an active call when the direct chat is blocked and rejects later signaling', async () => {
    const { memberOne, memberTwo, chatId } = await setupBlockingCallScenario();
    const incomingPromise = waitForSocketEvent(memberTwo.socket, 'call:incoming');
    const startAck = await emitWithAck(memberOne.socket, 'call:start', {
      chatId,
      mode: 'video',
    });
    await incomingPromise;
    await emitWithAck(memberTwo.socket, 'call:accept', {
      chatId,
      callId: startAck.callId,
    });

    const callerSyncPromise = waitForSocketEvent(memberOne.socket, 'call:sync');
    const calleeSyncPromise = waitForSocketEvent(memberTwo.socket, 'call:sync');
    await memberOne.agent.post(`/api/chat/${chatId}/block`).expect(200);
    const callerSync = await callerSyncPromise;
    const calleeSync = await calleeSyncPromise;
    const lateOfferAck = await emitWithAck(memberOne.socket, 'call:offer', {
      chatId,
      callId: startAck.callId,
      signal: { type: 'offer', sdp: 'late-test-sdp' },
    });
    const storedSession = await CallSession.findOne({ callId: startAck.callId });
    const activity = await Message.findOne({
      chatId,
      messageType: 'call',
      'callActivity.callId': startAck.callId,
    });

    expect(callerSync).toMatchObject({ callId: startAck.callId, status: 'blocked' });
    expect(calleeSync).toMatchObject({ callId: startAck.callId, status: 'blocked' });
    expect(lateOfferAck).toMatchObject({
      ok: false,
      event: 'call:offer',
      code: 'conversation_blocked',
    });
    expect(storedSession.status).toBe('blocked');
    expect(activity.callActivity.result).toBe('blocked');
  });
});
