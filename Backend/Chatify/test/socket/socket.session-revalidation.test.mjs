import { describe, expect, it, vi } from 'vitest';
import Session from '../../Models/sessionModel.mjs';
import {
  installSocketSessionLifecycle,
  revalidateSocketSessions,
  resetSocketSessionLifecycleForTests,
} from '../../Services/socketSessionLifecycleService.mjs';
import {
  createAccessToken,
  issueSessionCookies,
} from '../../Utils/tokenCookieGenerator.mjs';
import { createUser } from '../fixtures/users.mjs';

const createCookieResponse = () => ({
  cookie() { return this; },
  clearCookie() { return this; },
});

const createFakeSocket = ({ userId, sessionId, accessToken }) => {
  const disconnectHandlers = [];
  return {
    id: `socket-${sessionId}`,
    connected: true,
    data: { userId, sessionId },
    handshake: { headers: { cookie: `accessToken=${accessToken}` } },
    emit: vi.fn(),
    once(event, handler) {
      if (event === 'disconnect') disconnectHandlers.push(handler);
    },
    disconnect: vi.fn(function disconnect() {
      this.connected = false;
      disconnectHandlers.forEach((handler) => handler());
    }),
  };
};

describe('socket database session revalidation', () => {
  it('disconnects a locally owned socket after another instance revokes its session', async () => {
    resetSocketSessionLifecycleForTests();
    const user = await createUser();
    const issued = await issueSessionCookies({
      user,
      res: createCookieResponse(),
    });
    const accessToken = createAccessToken(user, issued.session);
    let connectionHandler;
    const io = {
      on(event, handler) {
        if (event === 'connection') connectionHandler = handler;
      },
    };

    installSocketSessionLifecycle(io);
    const socket = createFakeSocket({
      userId: user._id.toString(),
      sessionId: issued.session._id.toString(),
      accessToken,
    });
    connectionHandler(socket);

    await Session.updateOne(
      { _id: issued.session._id },
      { $set: { revokedAt: new Date() } }
    );
    await revalidateSocketSessions();

    expect(socket.emit).toHaveBeenCalledWith('auth:revoked', {
      reason: 'session_revoked_remote',
    });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.connected).toBe(false);
  });
});
