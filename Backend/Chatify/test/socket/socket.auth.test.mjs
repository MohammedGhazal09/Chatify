import { afterEach, describe, expect, it } from 'vitest';
import jsonwebtoken from 'jsonwebtoken';
import { createUser } from '../fixtures/users.mjs';
import { getCsrfForAgent, signupWithAgent } from '../helpers/authAgent.mjs';
import {
  connectSocketAsUser,
  connectSocketWithCookie,
  connectSocketWithReady,
  emitWithAck,
  extractCookieHeader,
  waitForSocketEvent,
} from '../helpers/socketClient.mjs';
import { startSocketTestServer } from '../helpers/socketServer.mjs';
import { getUserSockets } from '../../Config/socket.mjs';

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

const withProductionSocketOrigin = async (origin, callback) => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFrontendOrigin = process.env.FRONTEND_ORIGIN;

  try {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_ORIGIN = origin;
    await callback();
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.FRONTEND_ORIGIN = originalFrontendOrigin;
  }
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

describe('authenticated Socket.IO handshake', () => {
  it('accepts a socket with a valid accessToken cookie and stores verified identity', async () => {
    const server = await startServer();
    const { socket, user, ready } = await connectSocketAsUser(server.url);
    trackSocket(socket);

    expect(ready).toMatchObject({
      userId: user._id.toString(),
      socketId: socket.id,
    });
    expect(ready.joinedChats).toBe(0);
    expect(getUserSockets(user._id.toString()).has(socket.id)).toBe(true);
    expect(ready).not.toHaveProperty('email');
    expect(JSON.stringify(ready)).not.toContain(user.email);
  });

  it('accepts a handshake from the configured frontend origin', async () => {
    const server = await startServer();
    const { socket, user, ready } = await connectSocketAsUser(
      server.url,
      { firstName: 'Origin', lastName: 'Allowed' },
      {
        extraHeaders: {
          Origin: process.env.FRONTEND_ORIGIN_DEV,
        },
      }
    );
    trackSocket(socket);

    expect(ready).toMatchObject({
      userId: user._id.toString(),
      socketId: socket.id,
    });
  });

  it('accepts origin-less production polling from the configured same-origin proxy host', async () => {
    const server = await startServer();
    const signup = await signupWithAgent({ firstName: 'Vercel', lastName: 'Proxy' });

    await withProductionSocketOrigin('https://chatify-ten-rho.vercel.app', async () => {
      const socket = trackSocket(
        connectSocketWithCookie(server.url, extractCookieHeader(signup.response), {
          transports: ['polling'],
          extraHeaders: {
            'x-forwarded-host': 'chatify-ten-rho.vercel.app',
            'x-forwarded-proto': 'https',
          },
        })
      );
      const readyPromise = waitForSocketEvent(socket, 'socket:ready');

      socket.connect();
      const ready = await readyPromise;

      expect(ready).toMatchObject({
        userId: signup.user._id.toString(),
        socketId: socket.id,
      });
      expect(socket.connected).toBe(true);
    });
  });

  it('rejects origin-less production polling when it is not from the configured proxy host', async () => {
    const server = await startServer();
    const signup = await signupWithAgent({ firstName: 'No', lastName: 'Proxy' });

    await withProductionSocketOrigin('https://chatify-ten-rho.vercel.app', async () => {
      const socket = trackSocket(
        connectSocketWithCookie(server.url, extractCookieHeader(signup.response), {
          transports: ['polling'],
        })
      );
      const errorPromise = waitForSocketEvent(socket, 'connect_error');

      socket.connect();
      const error = await errorPromise;

      expect(error.message).toMatch(/xhr poll error|Socket origin not allowed/i);
      expect(socket.connected).toBe(false);
    });
  });

  it('rejects a socket without an accessToken cookie', async () => {
    const server = await startServer();
    const socket = trackSocket(connectSocketWithCookie(server.url, ''));
    const errorPromise = waitForSocketEvent(socket, 'connect_error');
    socket.connect();
    const error = await errorPromise;

    expect(error.message).toBe('Socket authentication required');
    expect(error.data).toMatchObject({ code: 'socket_auth_required' });
    expect(socket.connected).toBe(false);
  });

  it('rejects a socket with an invalid accessToken cookie', async () => {
    const server = await startServer();
    const socket = trackSocket(connectSocketWithCookie(server.url, 'accessToken=invalid-token'));
    const errorPromise = waitForSocketEvent(socket, 'connect_error');
    socket.connect();
    const error = await errorPromise;

    expect(error.message).toBe('Socket authentication invalid');
    expect(error.data).toMatchObject({ code: 'socket_auth_invalid' });
    expect(socket.connected).toBe(false);
  });

  it('rejects an expired access token and accepts the socket after HTTP refresh', async () => {
    const server = await startServer();
    const signup = await signupWithAgent({ firstName: 'Refresh', lastName: 'Socket' });
    const expiredAccessToken = jsonwebtoken.sign(
      {
        userId: signup.user._id.toString(),
        type: 'access',
        exp: Math.floor(Date.now() / 1000) - 10,
      },
      process.env.SECRET_JWT_KEY,
      { algorithm: 'HS256' }
    );
    const expiredSocket = trackSocket(connectSocketWithCookie(server.url, `accessToken=${expiredAccessToken}`));
    const errorPromise = waitForSocketEvent(expiredSocket, 'connect_error');

    expiredSocket.connect();
    const error = await errorPromise;

    expect(error.message).toBe('Socket authentication expired');
    expect(error.data).toMatchObject({ code: 'socket_auth_expired' });
    expect(expiredSocket.connected).toBe(false);

    const csrfToken = await getCsrfForAgent(signup.agent);
    const refreshResponse = await signup.agent
      .post('/api/auth/refresh-token')
      .set('X-CSRF-Token', csrfToken)
      .expect(200);
    const refreshed = await connectSocketWithReady(server.url, extractCookieHeader(refreshResponse));
    trackSocket(refreshed.socket);

    expect(refreshed.ready).toMatchObject({
      userId: signup.user._id.toString(),
      socketId: refreshed.socket.id,
    });
  });

  it('rejects a websocket handshake from a disallowed origin before authentication', async () => {
    const server = await startServer();
    const signup = await signupWithAgent({ firstName: 'Origin', lastName: 'Blocked' });
    const socket = trackSocket(
      connectSocketWithCookie(server.url, extractCookieHeader(signup.response), {
        transports: ['websocket'],
        extraHeaders: {
          Origin: 'https://attacker.example',
        },
      })
    );
    const errorPromise = waitForSocketEvent(socket, 'connect_error');

    socket.connect();
    const error = await errorPromise;

    expect(error.message).toMatch(/websocket error|Socket origin not allowed/i);
    expect(socket.connected).toBe(false);
  });

  it('does not allow user:connect to replace verified socket identity', async () => {
    const server = await startServer();
    const { socket, user, ready } = await connectSocketAsUser(server.url);
    trackSocket(socket);
    const outsider = await createUser({ firstName: 'Outside' });

    const response = await emitWithAck(socket, 'user:connect', outsider._id.toString());

    expect(response).toMatchObject({ ok: false, code: 'identity_already_verified' });
    expect(ready.userId).toBe(user._id.toString());
    expect(getUserSockets(user._id.toString()).has(socket.id)).toBe(true);
    expect(getUserSockets(outsider._id.toString()).has(socket.id)).toBe(false);
  });
});
