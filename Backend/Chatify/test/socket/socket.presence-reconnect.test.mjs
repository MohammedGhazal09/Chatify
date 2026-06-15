import { afterEach, describe, expect, it } from 'vitest';
import User from '../../Models/userModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';
import {
  connectSocketForSignup,
  connectSocketWithReady,
  extractCookieHeader,
  waitForSocketEvent,
} from '../helpers/socketClient.mjs';
import { startSocketTestServer } from '../helpers/socketServer.mjs';

const servers = [];
const sockets = [];

const wait = (timeoutMs) => new Promise((resolve) => setTimeout(resolve, timeoutMs));

const startServer = async () => {
  const server = await startSocketTestServer();
  servers.push(server);
  return server;
};

const trackSocket = (socket) => {
  sockets.push(socket);
  return socket;
};

const waitForNoMatchingSocketEvent = (socket, eventName, predicate, timeoutMs = 500) => {
  return new Promise((resolve) => {
    let matchedPayload;

    const onEvent = (payload) => {
      if (predicate(payload)) {
        matchedPayload = payload;
      }
    };

    socket.on(eventName, onEvent);

    setTimeout(() => {
      socket.off(eventName, onEvent);
      resolve(matchedPayload);
    }, timeoutMs);
  });
};

const setupPresenceScenario = async ({ hideMemberOne = false, hideMemberTwo = false } = {}) => {
  const server = await startServer();
  const memberOne = await signupWithAgent({ firstName: 'Presence', lastName: 'One' });
  const memberTwo = await signupWithAgent({ firstName: 'Presence', lastName: 'Two' });
  const outsider = await signupWithAgent({ firstName: 'Presence', lastName: 'Outsider' });

  if (hideMemberOne) {
    await User.findByIdAndUpdate(memberOne.user._id, { showOnlineStatus: false });
  }

  if (hideMemberTwo) {
    await User.findByIdAndUpdate(memberTwo.user._id, { showOnlineStatus: false });
  }

  const chat = await createDirectChat([memberOne.user, memberTwo.user]);

  return { server, memberOne, memberTwo, outsider, chat };
};

const connectTrackedSignup = async (url, signup) => {
  const result = await connectSocketForSignup(url, signup);
  trackSocket(result.socket);
  return result;
};

const connectTrackedWithCookie = async (url, cookieHeader) => {
  const result = await connectSocketWithReady(url, cookieHeader);
  trackSocket(result.socket);
  return result;
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

describe('Socket.IO presence and reconnect contract', () => {
  it('keeps a user online across multiple sockets and emits offline immediately after final disconnect', async () => {
    const { server, memberOne, memberTwo } = await setupPresenceScenario();
    const memberTwoSocket = await connectTrackedSignup(server.url, memberTwo);
    const onlinePromise = waitForSocketEvent(memberTwoSocket.socket, 'user:status-change');

    const memberOneSocketOne = await connectTrackedSignup(server.url, memberOne);
    const online = await onlinePromise;
    const memberOneSocketTwo = await connectTrackedWithCookie(
      server.url,
      extractCookieHeader(memberOne.response)
    );

    expect(online).toMatchObject({
      userId: memberOne.user._id.toString(),
      userName: 'Presence One',
      isOnline: true,
      isCallReachable: true,
    });

    const noOfflinePromise = waitForNoMatchingSocketEvent(
      memberTwoSocket.socket,
      'user:status-change',
      (payload) => payload.userId === memberOne.user._id.toString() && payload.isOnline === false,
      600
    );

    memberOneSocketOne.socket.disconnect();

    expect(await noOfflinePromise).toBeUndefined();

    const offlinePromise = waitForSocketEvent(memberTwoSocket.socket, 'user:status-change', 1000);
    memberOneSocketTwo.socket.disconnect();
    const offline = await offlinePromise;
    const storedUser = await User.findById(memberOne.user._id);

    expect(offline).toMatchObject({
      userId: memberOne.user._id.toString(),
      userName: 'Presence One',
      isOnline: false,
      isCallReachable: false,
    });
    expect(offline.lastSeen).toBeDefined();
    expect(storedUser.isOnline).toBe(false);
    expect(storedUser.lastSeen).toBeInstanceOf(Date);
  });

  it('emits online again when a user reconnects after the immediate offline transition', async () => {
    const { server, memberOne, memberTwo } = await setupPresenceScenario();
    const memberTwoSocket = await connectTrackedSignup(server.url, memberTwo);
    const onlinePromise = waitForSocketEvent(memberTwoSocket.socket, 'user:status-change');
    const memberOneSocket = await connectTrackedSignup(server.url, memberOne);
    await onlinePromise;

    const offlinePromise = waitForSocketEvent(memberTwoSocket.socket, 'user:status-change', 1000);
    memberOneSocket.socket.disconnect();
    const offline = await offlinePromise;
    const storedOfflineUser = await User.findById(memberOne.user._id);

    expect(offline).toMatchObject({
      userId: memberOne.user._id.toString(),
      isOnline: false,
      isCallReachable: false,
    });
    expect(storedOfflineUser.isOnline).toBe(false);

    const onlineAgainPromise = waitForSocketEvent(memberTwoSocket.socket, 'user:status-change', 1000);
    const reconnected = await connectTrackedWithCookie(server.url, extractCookieHeader(memberOne.response));
    const onlineAgain = await onlineAgainPromise;

    expect(reconnected.ready).toMatchObject({
      userId: memberOne.user._id.toString(),
      joinedChats: 1,
    });
    const storedUser = await User.findById(memberOne.user._id);

    expect(onlineAgain).toMatchObject({
      userId: memberOne.user._id.toString(),
      userName: 'Presence One',
      isOnline: true,
      isCallReachable: true,
    });
    expect(storedUser.isOnline).toBe(true);
  });

  it('suppresses presence broadcasts when showOnlineStatus is disabled', async () => {
    const { server, memberOne, memberTwo } = await setupPresenceScenario({ hideMemberOne: true });
    const memberTwoSocket = await connectTrackedSignup(server.url, memberTwo);
    const hiddenPresencePromise = waitForNoMatchingSocketEvent(
      memberTwoSocket.socket,
      'user:status-change',
      (payload) => payload.userId === memberOne.user._id.toString(),
      700
    );

    await connectTrackedSignup(server.url, memberOne);

    expect(await hiddenPresencePromise).toBeUndefined();
  });

  it('emits socket readiness again on reconnect with joined chats and authorized presence snapshot', async () => {
    const { server, memberOne, memberTwo, outsider } = await setupPresenceScenario();
    const memberTwoSocket = await connectTrackedSignup(server.url, memberTwo);
    const memberOneSocket = await connectTrackedSignup(server.url, memberOne);
    const outsiderSocket = await connectTrackedSignup(server.url, outsider);

    expect(memberOneSocket.ready).toMatchObject({
      userId: memberOne.user._id.toString(),
      joinedChats: 1,
    });
    expect(memberOneSocket.ready.presence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: memberTwo.user._id.toString(),
          isOnline: true,
          isCallReachable: true,
        }),
      ])
    );
    expect(memberOneSocket.ready.presence).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: outsider.user._id.toString(),
        }),
      ])
    );

    memberOneSocket.socket.disconnect();
    await wait(500);

    const reconnected = await connectTrackedWithCookie(server.url, extractCookieHeader(memberOne.response));

    expect(reconnected.ready).toMatchObject({
      userId: memberOne.user._id.toString(),
      joinedChats: 1,
    });
    expect(reconnected.ready.presence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: memberTwo.user._id.toString(),
          isOnline: true,
          isCallReachable: true,
        }),
      ])
    );
    expect(memberTwoSocket.socket.connected).toBe(true);
    expect(outsiderSocket.socket.connected).toBe(true);
  });

  it('includes offline authorized contacts in socket readiness presence snapshots', async () => {
    const { server, memberOne, memberTwo, outsider } = await setupPresenceScenario();
    const memberOneSocket = await connectTrackedSignup(server.url, memberOne);

    expect(memberOneSocket.ready.presence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: memberTwo.user._id.toString(),
          userName: 'Presence Two',
          isOnline: false,
          isCallReachable: false,
        }),
      ])
    );
    expect(memberOneSocket.ready.presence).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: outsider.user._id.toString(),
        }),
      ])
    );
  });

  it('does not expose hidden online status in socket readiness snapshots', async () => {
    const { server, memberOne, memberTwo } = await setupPresenceScenario({ hideMemberTwo: true });
    await connectTrackedSignup(server.url, memberTwo);
    const memberOneSocket = await connectTrackedSignup(server.url, memberOne);

    expect(memberOneSocket.ready.presence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: memberTwo.user._id.toString(),
          userName: 'Presence Two',
          isOnline: false,
          isCallReachable: false,
        }),
      ])
    );
  });

  it('returns HTTP presence with display online state and socket call reachability', async () => {
    const { server, memberOne, memberTwo } = await setupPresenceScenario();
    await connectTrackedSignup(server.url, memberTwo);

    const response = await memberOne.agent
      .get('/api/user/online-users')
      .expect(200);

    expect(response.body.data.allContacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: memberTwo.user._id.toString(),
          isOnline: true,
          isCallReachable: true,
        }),
      ])
    );
    expect(response.body.data.onlineUsers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: memberTwo.user._id.toString(),
          isOnline: true,
          isCallReachable: true,
        }),
      ])
    );
  });
});
