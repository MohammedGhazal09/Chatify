import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CallSession from '../../Models/callSessionModel.mjs';
import { getCallIceConfig } from '../../Utils/callIceConfig.mjs';
import { startCallSession } from '../../Utils/callSessionState.mjs';
import { CRITICAL_DATABASE_INDEX_REQUIREMENTS } from '../../Utils/databaseIndexPolicy.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';
import {
  connectSocketAsUser,
  connectSocketForSignup,
  emitWithAck,
  waitForSocketEvent,
} from '../helpers/socketClient.mjs';
import { startSocketTestServer } from '../helpers/socketServer.mjs';

const servers = [];
const sockets = [];
const ORIGINAL_CALL_ENV = Object.freeze({
  CALL_STUN_URLS: process.env.CALL_STUN_URLS,
  CALL_TURN_URLS: process.env.CALL_TURN_URLS,
  CALL_TURN_USERNAME: process.env.CALL_TURN_USERNAME,
  CALL_TURN_CREDENTIAL: process.env.CALL_TURN_CREDENTIAL,
});

const restoreEnv = (key, value) => {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
};

const startServer = async () => {
  const server = await startSocketTestServer();
  servers.push(server);
  return server;
};

const trackSocket = (socket) => {
  sockets.push(socket);
  return socket;
};

const waitForNoSocketEvent = (socket, eventName, timeoutMs = 400) => new Promise((resolve) => {
  let payload;
  const onEvent = (eventPayload) => {
    payload = eventPayload;
  };

  socket.on(eventName, onEvent);
  setTimeout(() => {
    socket.off(eventName, onEvent);
    resolve(payload);
  }, timeoutMs);
});

const setupSocketCall = async () => {
  await CallSession.init();
  const server = await startServer();
  const caller = await connectSocketAsUser(server.url, { firstName: 'Phase', lastName: 'Caller' });
  const callee = await connectSocketAsUser(server.url, { firstName: 'Phase', lastName: 'Callee' });
  const outsider = await connectSocketAsUser(server.url, { firstName: 'Phase', lastName: 'Outsider' });

  trackSocket(caller.socket);
  trackSocket(callee.socket);
  trackSocket(outsider.socket);

  const chat = await createDirectChat([caller.user, callee.user]);
  const chatId = chat._id.toString();
  await emitWithAck(caller.socket, 'chat:join', chatId);
  await emitWithAck(callee.socket, 'chat:join', chatId);

  return { server, caller, callee, outsider, chat, chatId };
};

afterEach(async () => {
  vi.restoreAllMocks();
  sockets.splice(0).forEach((socket) => {
    if (socket.connected || socket.active) {
      socket.disconnect();
    }
  });

  for (const server of servers.splice(0)) {
    await server.close();
  }

  Object.entries(ORIGINAL_CALL_ENV).forEach(([key, value]) => restoreEnv(key, value));
});

describe('Phase 15 WebRTC and call-signaling security', () => {
  it('accepts only bounded public STUN and TURN destinations', () => {
    const config = getCallIceConfig({
      NODE_ENV: 'production',
      CALL_STUN_URLS: [
        'https://not-an-ice-server.example.test',
        'stun:127.0.0.1:3478',
        'stun:stun.example.test:3478',
        'stuns:secure-stun.example.test:5349',
      ].join(','),
      CALL_TURN_URLS: [
        'http://turn.example.test',
        'turn:10.0.0.8:3478?transport=udp',
        'turns:turn.example.test:5349?transport=tcp',
        'turn:turn.example.test:3478?transport=sctp',
      ].join(','),
      CALL_TURN_USERNAME: 'phase-15-user',
      CALL_TURN_CREDENTIAL: 'phase-15-credential',
    });

    expect(config).toMatchObject({
      turnReady: true,
      productionReady: true,
    });
    expect(config.iceServers).toEqual([
      { urls: 'stun:stun.example.test:3478' },
      { urls: 'stuns:secure-stun.example.test:5349' },
      {
        urls: 'turns:turn.example.test:5349?transport=tcp',
        username: 'phase-15-user',
        credential: 'phase-15-credential',
      },
    ]);
  });

  it('does not expose reusable TURN credentials in generic socket readiness', async () => {
    process.env.CALL_STUN_URLS = 'stun:stun.example.test:3478';
    process.env.CALL_TURN_URLS = 'turns:turn.example.test:5349?transport=tcp';
    process.env.CALL_TURN_USERNAME = 'readiness-user';
    process.env.CALL_TURN_CREDENTIAL = 'READINESS_PRIVATE_TURN_CREDENTIAL';

    const server = await startServer();
    const connected = await connectSocketAsUser(server.url, {
      firstName: 'Ready',
      lastName: 'Private',
    });
    trackSocket(connected.socket);

    expect(connected.ready.callConfig).toMatchObject({
      iceServers: [],
      turnReady: true,
      productionReady: true,
    });
    expect(JSON.stringify(connected.ready)).not.toContain('readiness-user');
    expect(JSON.stringify(connected.ready)).not.toContain('READINESS_PRIVATE_TURN_CREDENTIAL');
  });

  it('rejects offers before the call is accepted and forwards authenticated identity after acceptance', async () => {
    const { caller, callee, outsider, chatId } = await setupSocketCall();
    const incomingPromise = waitForSocketEvent(callee.socket, 'call:incoming');
    const startAck = await emitWithAck(caller.socket, 'call:start', { chatId, mode: 'audio' });
    await incomingPromise;

    const noEarlyOffer = waitForNoSocketEvent(callee.socket, 'call:offer');
    const earlyOfferAck = await emitWithAck(caller.socket, 'call:offer', {
      chatId,
      callId: startAck.callId,
      fromUserId: outsider.user._id.toString(),
      signal: {
        type: 'offer',
        sdp: 'phase-15-early-offer',
        fromUserId: outsider.user._id.toString(),
      },
    });

    expect(earlyOfferAck).toMatchObject({
      ok: false,
      event: 'call:offer',
      code: 'call_not_connected',
    });
    await expect(noEarlyOffer).resolves.toBeUndefined();

    await emitWithAck(callee.socket, 'call:accept', {
      chatId,
      callId: startAck.callId,
    });
    const offerPromise = waitForSocketEvent(callee.socket, 'call:offer');
    const offerAck = await emitWithAck(caller.socket, 'call:offer', {
      chatId,
      callId: startAck.callId,
      fromUserId: outsider.user._id.toString(),
      signal: {
        type: 'offer',
        sdp: 'phase-15-connected-offer',
        fromUserId: outsider.user._id.toString(),
      },
    });
    const forwarded = await offerPromise;

    expect(offerAck).toMatchObject({ ok: true, event: 'call:offer' });
    expect(forwarded).toEqual({
      callId: startAck.callId,
      chatId,
      fromUserId: caller.user._id.toString(),
      signal: {
        type: 'offer',
        sdp: 'phase-15-connected-offer',
      },
    });
  });

  it('shares the call-start rate limit across every socket of one authenticated user', async () => {
    const server = await startServer();
    const primary = await connectSocketAsUser(server.url, {
      firstName: 'Rate',
      lastName: 'Limited',
    });
    const secondary = await connectSocketForSignup(server.url, primary);
    trackSocket(primary.socket);
    trackSocket(secondary.socket);
    const unknownChatId = new mongoose.Types.ObjectId().toString();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const ack = await emitWithAck(primary.socket, 'call:start', {
        chatId: unknownChatId,
        mode: 'audio',
      });
      expect(ack.code).not.toBe('rate_limited');
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const ack = await emitWithAck(secondary.socket, 'call:start', {
        chatId: unknownChatId,
        mode: 'audio',
      });
      expect(ack.code).not.toBe('rate_limited');
    }

    await expect(emitWithAck(secondary.socket, 'call:start', {
      chatId: unknownChatId,
      mode: 'audio',
    })).resolves.toMatchObject({
      ok: false,
      event: 'call:start',
      code: 'rate_limited',
    });
  });

  it('enforces active participant uniqueness at the database boundary and maps races to call_busy', async () => {
    await CallSession.init();
    const caller = await signupWithAgent({ firstName: 'Race', lastName: 'Caller' });
    const callee = await signupWithAgent({ firstName: 'Race', lastName: 'Callee' });
    const chat = await createDirectChat([caller.user, callee.user]);

    const indexDefinition = CallSession.schema.indexes().find(([keys]) => keys.participantIds === 1);
    expect(indexDefinition?.[1]).toMatchObject({
      unique: true,
      partialFilterExpression: {
        status: { $in: ['ringing', 'connected'] },
      },
    });
    expect(CRITICAL_DATABASE_INDEX_REQUIREMENTS.map((entry) => entry.id)).toContain(
      'call-sessions.active-participant.unique-partial'
    );

    await startCallSession({
      chat,
      callerId: caller.user._id,
      recipientIds: [callee.user._id],
      mode: 'audio',
    });

    const findOneSpy = vi.spyOn(CallSession, 'findOne').mockReturnValueOnce({
      lean: async () => null,
    });

    try {
      await expect(startCallSession({
        chat,
        callerId: caller.user._id,
        recipientIds: [callee.user._id],
        mode: 'audio',
      })).rejects.toMatchObject({
        code: 'call_busy',
        statusCode: 409,
      });
    } finally {
      findOneSpy.mockRestore();
    }

    await expect(CallSession.countDocuments({
      status: { $in: ['ringing', 'connected'] },
      participantIds: caller.user._id,
    })).resolves.toBe(1);
  });
});
