import { afterEach, describe, expect, it } from 'vitest';
import CallSession from '../../Models/callSessionModel.mjs';
import Message from '../../Models/messageModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import {
  connectSocketAsUser,
  connectSocketForSignup,
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

const setupCallScenario = async () => {
  await CallSession.init();
  await Message.init();

  const server = await startServer();
  const caller = await connectSocketAsUser(server.url, { firstName: 'Call', lastName: 'Caller' });
  const callee = await connectSocketAsUser(server.url, { firstName: 'Call', lastName: 'Callee' });
  const outsider = await connectSocketAsUser(server.url, { firstName: 'Call', lastName: 'Outsider' });

  trackSocket(caller.socket);
  trackSocket(callee.socket);
  trackSocket(outsider.socket);

  const chat = await createDirectChat([caller.user, callee.user]);
  const chatId = chat._id.toString();

  await emitWithAck(caller.socket, 'chat:join', chatId);
  await emitWithAck(callee.socket, 'chat:join', chatId);

  return { server, caller, callee, outsider, chat, chatId };
};

const startCall = async ({ caller, callee, chatId, mode = 'audio' }) => {
  const incomingPromise = waitForSocketEvent(callee.socket, 'call:incoming');
  const ack = await emitWithAck(caller.socket, 'call:start', { chatId, mode });
  const incoming = await incomingPromise;

  return { ack, incoming };
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

describe('Socket.IO call lifecycle', () => {
  it('starts a direct audio call, rings the callee, and accepts once', async () => {
    const { caller, callee, chatId } = await setupCallScenario();
    const { ack, incoming } = await startCall({ caller, callee, chatId });
    const callerSyncPromise = waitForSocketEvent(caller.socket, 'call:sync');

    expect(ack).toMatchObject({
      ok: true,
      event: 'call:start',
      chatId,
      callerId: caller.user._id.toString(),
      calleeId: callee.user._id.toString(),
      mode: 'audio',
      status: 'ringing',
      callConfig: {
        turnReady: expect.any(Boolean),
        productionReady: expect.any(Boolean),
      },
    });
    expect(incoming).toMatchObject({
      callId: ack.callId,
      chatId,
      callerId: caller.user._id.toString(),
      calleeId: callee.user._id.toString(),
      mode: 'audio',
      status: 'ringing',
    });

    const acceptAck = await emitWithAck(callee.socket, 'call:accept', {
      chatId,
      callId: ack.callId,
    });
    const callerSync = await callerSyncPromise;

    expect(acceptAck).toMatchObject({
      ok: true,
      event: 'call:accept',
      callId: ack.callId,
      status: 'connected',
    });
    expect(callerSync).toMatchObject({
      callId: ack.callId,
      status: 'connected',
      answeredAt: expect.any(String),
    });
    await expect(CallSession.countDocuments({
      callId: ack.callId,
      status: 'connected',
    })).resolves.toBe(1);
  });

  it('rejects group chats, non-members, duplicate calls, and stale transitions', async () => {
    const { caller, callee, outsider, chatId } = await setupCallScenario();
    const groupChat = await createDirectChat([caller.user, callee.user, outsider.user], {
      chatName: 'Group call not supported',
      isGroupChat: true,
    });

    await emitWithAck(caller.socket, 'chat:join', groupChat._id.toString());
    const groupAck = await emitWithAck(caller.socket, 'call:start', {
      chatId: groupChat._id.toString(),
      mode: 'audio',
    });
    const outsiderAck = await emitWithAck(outsider.socket, 'call:start', {
      chatId,
      mode: 'audio',
    });
    const { ack } = await startCall({ caller, callee, chatId });
    const duplicateAck = await emitWithAck(caller.socket, 'call:start', {
      chatId,
      mode: 'video',
    });
    await emitWithAck(callee.socket, 'call:reject', {
      chatId,
      callId: ack.callId,
    });
    const staleAcceptAck = await emitWithAck(callee.socket, 'call:accept', {
      chatId,
      callId: ack.callId,
    });

    expect(groupAck).toMatchObject({ ok: false, event: 'call:start', code: 'not_direct_chat' });
    expect(outsiderAck).toMatchObject({ ok: false, event: 'call:start', code: 'forbidden_or_not_found' });
    expect(duplicateAck).toMatchObject({ ok: false, event: 'call:start', code: 'call_busy' });
    expect(staleAcceptAck).toMatchObject({ ok: false, event: 'call:accept', code: 'stale_call' });
  });

  it('fails truthfully when the callee has no reachable socket and does not create a missed call', async () => {
    await CallSession.init();
    await Message.init();

    const server = await startServer();
    const caller = await connectSocketAsUser(server.url, { firstName: 'Offline', lastName: 'Caller' });
    const offlineCallee = await connectSocketAsUser(server.url, { firstName: 'Offline', lastName: 'Callee' });

    trackSocket(caller.socket);
    trackSocket(offlineCallee.socket);

    const chat = await createDirectChat([caller.user, offlineCallee.user]);
    const chatId = chat._id.toString();
    await emitWithAck(caller.socket, 'chat:join', chatId);
    offlineCallee.socket.disconnect();

    const ack = await emitWithAck(caller.socket, 'call:start', { chatId, mode: 'audio' });

    expect(ack).toMatchObject({
      ok: false,
      event: 'call:start',
      code: 'callee_unavailable',
    });
    await expect(CallSession.countDocuments({ chatId: chat._id })).resolves.toBe(0);
    await expect(Message.countDocuments({ chatId: chat._id, messageType: 'call' })).resolves.toBe(0);
  });

  it('rings every callee tab and synchronizes the first accepted decision', async () => {
    const { server, caller, callee, chatId } = await setupCallScenario();
    const secondCalleeSocket = await connectSocketForSignup(server.url, callee);

    trackSocket(secondCalleeSocket.socket);
    await emitWithAck(secondCalleeSocket.socket, 'chat:join', chatId);

    const primaryIncomingPromise = waitForSocketEvent(callee.socket, 'call:incoming');
    const secondaryIncomingPromise = waitForSocketEvent(secondCalleeSocket.socket, 'call:incoming');
    const ack = await emitWithAck(caller.socket, 'call:start', { chatId, mode: 'video' });
    const primaryIncoming = await primaryIncomingPromise;
    const secondaryIncoming = await secondaryIncomingPromise;

    expect(primaryIncoming.callId).toBe(ack.callId);
    expect(secondaryIncoming.callId).toBe(ack.callId);

    const syncPromise = waitForSocketEvent(secondCalleeSocket.socket, 'call:sync');
    const acceptAck = await emitWithAck(callee.socket, 'call:accept', {
      chatId,
      callId: ack.callId,
    });
    const secondTabSync = await syncPromise;

    expect(acceptAck).toMatchObject({ ok: true, status: 'connected' });
    expect(secondTabSync).toMatchObject({ callId: ack.callId, status: 'connected' });
  });

  it('fails an accepted call after the disconnected participant grace period', async () => {
    const previousGraceMs = process.env.CHATIFY_CALL_DISCONNECT_GRACE_MS;
    process.env.CHATIFY_CALL_DISCONNECT_GRACE_MS = '25';

    try {
      const { caller, callee, chatId } = await setupCallScenario();
      const { ack } = await startCall({ caller, callee, chatId });
      const connectedSyncPromise = waitForSocketEvent(caller.socket, 'call:sync');

      await emitWithAck(callee.socket, 'call:accept', {
        chatId,
        callId: ack.callId,
      });
      await expect(connectedSyncPromise).resolves.toMatchObject({
        callId: ack.callId,
        status: 'connected',
      });

      const failedSyncPromise = waitForSocketEvent(caller.socket, 'call:sync');
      callee.socket.disconnect();
      const failedSync = await failedSyncPromise;

      expect(failedSync).toMatchObject({
        callId: ack.callId,
        status: 'failed',
        endedReason: 'failed',
      });

      const storedSession = await CallSession.findOne({ callId: ack.callId }).lean();
      expect(storedSession).toMatchObject({
        status: 'failed',
        endedReason: 'failed',
      });
      await expect(Message.findOne({
        chatId,
        messageType: 'call',
        'callActivity.callId': ack.callId,
      }).lean()).resolves.toMatchObject({
        callActivity: expect.objectContaining({ result: 'failed' }),
      });

      const retryAck = await emitWithAck(caller.socket, 'call:start', { chatId, mode: 'audio' });
      expect(retryAck).toMatchObject({
        ok: false,
        event: 'call:start',
        code: 'callee_unavailable',
      });
    } finally {
      if (previousGraceMs === undefined) {
        delete process.env.CHATIFY_CALL_DISCONNECT_GRACE_MS;
      } else {
        process.env.CHATIFY_CALL_DISCONNECT_GRACE_MS = previousGraceMs;
      }
    }
  });

  it('forwards offer answer and ice only to the authorized peer sockets', async () => {
    const { caller, callee, outsider, chatId } = await setupCallScenario();
    const { ack } = await startCall({ caller, callee, chatId });
    await emitWithAck(callee.socket, 'call:accept', { chatId, callId: ack.callId });

    const offerPromise = waitForSocketEvent(callee.socket, 'call:offer');
    const noOutsiderOfferPromise = waitForNoSocketEvent(outsider.socket, 'call:offer');
    const offerAck = await emitWithAck(caller.socket, 'call:offer', {
      chatId,
      callId: ack.callId,
      signal: { type: 'offer', sdp: 'redacted-test-sdp' },
    });
    const offer = await offerPromise;
    const outsiderOffer = await noOutsiderOfferPromise;

    expect(offerAck).toMatchObject({ ok: true, event: 'call:offer', callId: ack.callId });
    expect(offer).toMatchObject({
      callId: ack.callId,
      chatId,
      fromUserId: caller.user._id.toString(),
      signal: { type: 'offer', sdp: 'redacted-test-sdp' },
    });
    expect(outsiderOffer).toBeUndefined();
  });

  it('rejects invalid and oversized signaling payloads before forwarding to the peer', async () => {
    const { caller, callee, chatId } = await setupCallScenario();
    const { ack } = await startCall({ caller, callee, chatId });
    await emitWithAck(callee.socket, 'call:accept', { chatId, callId: ack.callId });

    const invalidOfferPromise = waitForNoSocketEvent(callee.socket, 'call:offer');
    const invalidOfferAck = await emitWithAck(caller.socket, 'call:offer', {
      chatId,
      callId: ack.callId,
      signal: { type: 'answer', sdp: 'wrong-signal-type' },
    });

    expect(invalidOfferAck).toMatchObject({
      ok: false,
      event: 'call:offer',
      code: 'invalid_call_signal',
    });
    await expect(invalidOfferPromise).resolves.toBeUndefined();

    const invalidIcePromise = waitForNoSocketEvent(callee.socket, 'call:ice-candidate');
    const invalidIceAck = await emitWithAck(caller.socket, 'call:ice-candidate', {
      chatId,
      callId: ack.callId,
      signal: { candidate: 'x'.repeat(9000), sdpMid: '0', sdpMLineIndex: 0 },
    });

    expect(invalidIceAck).toMatchObject({
      ok: false,
      event: 'call:ice-candidate',
      code: 'invalid_call_signal',
    });
    await expect(invalidIcePromise).resolves.toBeUndefined();
  });
});
