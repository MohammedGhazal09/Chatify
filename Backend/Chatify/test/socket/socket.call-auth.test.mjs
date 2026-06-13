import { afterEach, describe, expect, it } from 'vitest';
import CallSession from '../../Models/callSessionModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import {
  connectSocketAsUser,
  connectSocketWithCookie,
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

describe('Socket.IO call auth and config contract', () => {
  it('rejects unauthenticated sockets before call events are available', async () => {
    const server = await startServer();
    const socket = trackSocket(connectSocketWithCookie(server.url, ''));
    const connectErrorPromise = waitForSocketEvent(socket, 'connect_error');

    socket.connect();
    const error = await connectErrorPromise;

    expect(error.message).toBe('Socket authentication required');
    expect(error.data).toEqual({ code: 'socket_auth_required' });
  });

  it('includes backend-controlled call config in socket readiness without private application secrets', async () => {
    const server = await startServer();
    const caller = await connectSocketAsUser(server.url, { firstName: 'Ready', lastName: 'Caller' });

    trackSocket(caller.socket);

    expect(caller.ready.callConfig).toMatchObject({
      iceServers: expect.arrayContaining([
        expect.objectContaining({ urls: expect.any(String) }),
      ]),
      turnReady: expect.any(Boolean),
      productionReady: expect.any(Boolean),
      warnings: expect.any(Array),
    });
    expect(JSON.stringify(caller.ready.callConfig)).not.toContain('SECRET_JWT_KEY');
    expect(JSON.stringify(caller.ready.callConfig)).not.toContain('cookie');
  });

  it('returns structured errors for invalid call payloads and start acknowledgements include ICE config', async () => {
    await CallSession.init();

    const server = await startServer();
    const caller = await connectSocketAsUser(server.url, { firstName: 'Ack', lastName: 'Caller' });
    const callee = await connectSocketAsUser(server.url, { firstName: 'Ack', lastName: 'Callee' });

    trackSocket(caller.socket);
    trackSocket(callee.socket);

    const chat = await createDirectChat([caller.user, callee.user]);
    const chatId = chat._id.toString();

    await emitWithAck(caller.socket, 'chat:join', chatId);
    await emitWithAck(callee.socket, 'chat:join', chatId);

    const invalidModeAck = await emitWithAck(caller.socket, 'call:start', {
      chatId,
      mode: 'screen',
    });
    const incomingPromise = waitForSocketEvent(callee.socket, 'call:incoming');
    const startAck = await emitWithAck(caller.socket, 'call:start', {
      chatId,
      mode: 'audio',
    });
    await incomingPromise;

    expect(invalidModeAck).toMatchObject({
      ok: false,
      event: 'call:start',
      code: 'invalid_call_mode',
      message: 'Call mode must be audio or video',
    });
    expect(startAck).toMatchObject({
      ok: true,
      event: 'call:start',
      callId: expect.any(String),
      status: 'ringing',
      callConfig: {
        iceServers: expect.any(Array),
        turnReady: expect.any(Boolean),
      },
    });
  });
});
