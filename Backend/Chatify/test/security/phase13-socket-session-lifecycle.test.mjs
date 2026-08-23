import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jsonwebtoken from 'jsonwebtoken';

const emailMocks = vi.hoisted(() => ({
  sendNotificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock('../../Services/emailService.mjs', () => emailMocks);

import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  readAccessTokenFromCookieHeader,
} from '../../Utils/authToken.mjs';
import { emitToUserSockets } from '../../Config/socket.mjs';
import {
  createAgent,
  getCsrfForAgent,
  loginWithAgent,
  signupWithAgent,
} from '../helpers/authAgent.mjs';
import {
  connectSocketWithReady,
  extractCookieHeader,
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

const connectFromResponse = async (server, response, options = {}) => {
  const connected = await connectSocketWithReady(
    server.url,
    extractCookieHeader(response),
    options
  );
  trackSocket(connected.socket);
  return connected;
};

const getSessionIdFromResponse = (response) => {
  const token = readAccessTokenFromCookieHeader(extractCookieHeader(response));
  const decoded = jsonwebtoken.decode(token);
  return decoded?.sessionId?.toString?.() ?? null;
};

const waitForRevocation = (socket, timeoutMs = 5_000) => ({
  revoked: waitForSocketEvent(socket, 'auth:revoked', timeoutMs),
  disconnected: waitForSocketEvent(socket, 'disconnect', timeoutMs),
});

const expectRevoked = async (pending, reason) => {
  const [payload, disconnectReason] = await Promise.all([
    pending.revoked,
    pending.disconnected,
  ]);

  expect(payload).toMatchObject({ reason });
  expect(disconnectReason).toBe('io server disconnect');
};

const postAuthMutation = async (agent, path, body) => {
  const csrfToken = await getCsrfForAgent(agent);
  return agent
    .post(path)
    .set('X-CSRF-Token', csrfToken)
    .send(body ?? {});
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

beforeEach(() => {
  emailMocks.sendNotificationEmail.mockReset();
  emailMocks.sendPasswordResetEmail.mockReset();
  emailMocks.sendPasswordResetEmail.mockResolvedValue({ messageId: 'phase-13-reset' });
});

describe('Phase 13 Socket.IO session lifecycle', () => {
  it('disconnects the current session immediately after logout', async () => {
    const server = await startServer();
    const signup = await signupWithAgent({ firstName: 'Socket', lastName: 'Logout' });
    const { socket } = await connectFromResponse(server, signup.response);
    const pending = waitForRevocation(socket);

    await postAuthMutation(signup.agent, '/api/auth/logout').then((response) => {
      expect(response.statusCode).toBe(200);
    });

    await expectRevoked(pending, 'session_logout');
    expect(socket.connected).toBe(false);
    expect(emitToUserSockets(signup.user._id, 'phase13:private', { marker: 'after-logout' }))
      .toBe(0);
  });

  it('disconnects the old socket when refresh rotation replaces its session', async () => {
    const server = await startServer();
    const signup = await signupWithAgent({ firstName: 'Socket', lastName: 'Refresh' });
    const { socket: oldSocket } = await connectFromResponse(server, signup.response);
    const pending = waitForRevocation(oldSocket);

    const refreshResponse = await postAuthMutation(signup.agent, '/api/auth/refresh-token');
    expect(refreshResponse.statusCode).toBe(200);
    await expectRevoked(pending, 'session_rotated');

    const { socket: refreshedSocket, ready } = await connectFromResponse(server, refreshResponse);
    expect(ready.userId).toBe(signup.user._id.toString());
    expect(refreshedSocket.connected).toBe(true);
  });

  it('disconnects only the specifically revoked secondary session', async () => {
    const server = await startServer();
    const signup = await signupWithAgent({ firstName: 'Socket', lastName: 'Targeted' });
    const secondary = await loginWithAgent({
      email: signup.user.email,
      password: signup.payload.password,
    });
    const secondarySessionId = getSessionIdFromResponse(secondary.response);
    const { socket: secondarySocket } = await connectFromResponse(server, secondary.response);
    const pending = waitForRevocation(secondarySocket);
    const csrfToken = await getCsrfForAgent(signup.agent);

    const response = await signup.agent
      .delete(`/api/auth/sessions/${secondarySessionId}`)
      .set('X-CSRF-Token', csrfToken);

    expect(response.statusCode).toBe(200);
    await expectRevoked(pending, 'session_revoked');
    expect(secondarySocket.connected).toBe(false);
    expect(emitToUserSockets(signup.user._id, 'phase13:private', { marker: 'after-revoke' }))
      .toBe(0);
  });

  it('disconnects every device after revoke-all', async () => {
    const server = await startServer();
    const signup = await signupWithAgent({ firstName: 'Socket', lastName: 'All' });
    const secondary = await loginWithAgent({
      email: signup.user.email,
      password: signup.payload.password,
    });
    const primaryConnection = await connectFromResponse(server, signup.response);
    const secondaryConnection = await connectFromResponse(server, secondary.response);
    const primaryPending = waitForRevocation(primaryConnection.socket);
    const secondaryPending = waitForRevocation(secondaryConnection.socket);

    const response = await postAuthMutation(signup.agent, '/api/auth/sessions/revoke-all');
    expect(response.statusCode).toBe(200);

    await Promise.all([
      expectRevoked(primaryPending, 'all_sessions_revoked'),
      expectRevoked(secondaryPending, 'all_sessions_revoked'),
    ]);
    expect(emitToUserSockets(signup.user._id, 'phase13:private', { marker: 'after-revoke-all' }))
      .toBe(0);
  });

  it('disconnects active sockets after a successful password reset', async () => {
    const server = await startServer();
    const signup = await signupWithAgent({ firstName: 'Socket', lastName: 'Password' });
    const { socket } = await connectFromResponse(server, signup.response);
    const resetAgent = await createAgent();
    const resetCsrf = await getCsrfForAgent(resetAgent);

    await resetAgent
      .post('/api/auth/forgot-password')
      .set('X-CSRF-Token', resetCsrf)
      .send({ email: signup.user.email })
      .expect(200);
    const resetCode = emailMocks.sendPasswordResetEmail.mock.calls.at(-1)?.[1];
    expect(resetCode).toMatch(/^\d{6}$/);

    const pending = waitForRevocation(socket);
    await resetAgent
      .post('/api/auth/reset-password')
      .set('X-CSRF-Token', resetCsrf)
      .send({
        email: signup.user.email,
        code: resetCode,
        newPassword: 'Phase13Password123!',
      })
      .expect(200);

    await expectRevoked(pending, 'password_reset');
    expect(emitToUserSockets(signup.user._id, 'phase13:private', { marker: 'after-reset' }))
      .toBe(0);
  });

  it('disconnects a socket when its verified access token expires', async () => {
    const server = await startServer();
    const signup = await signupWithAgent({ firstName: 'Socket', lastName: 'Expiry' });
    const existingToken = readAccessTokenFromCookieHeader(extractCookieHeader(signup.response));
    const decoded = jsonwebtoken.decode(existingToken);
    const shortLivedToken = jsonwebtoken.sign(
      {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        type: 'access',
        jti: randomUUID(),
      },
      process.env.SECRET_JWT_KEY,
      {
        algorithm: 'HS256',
        expiresIn: '3s',
        subject: decoded.userId,
        issuer: ACCESS_TOKEN_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
      }
    );
    const { socket } = await connectSocketWithReady(
      server.url,
      `accessToken=${encodeURIComponent(shortLivedToken)}`
    );
    trackSocket(socket);
    const pending = waitForRevocation(socket, 7_000);

    await expectRevoked(pending, 'access_token_expired');
    expect(socket.connected).toBe(false);
  });
});
