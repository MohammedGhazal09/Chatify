import { afterEach, describe, expect, it } from 'vitest';

import User from '../../Models/userModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';
import {
  connectSocketForSignup,
  waitForSocketEvent,
} from '../helpers/socketClient.mjs';
import { startSocketTestServer } from '../helpers/socketServer.mjs';

const servers = [];
const sockets = [];
const FIXED_LAST_SEEN = new Date('2026-08-01T12:00:00.000Z');

const startServer = async () => {
  const server = await startSocketTestServer();
  servers.push(server);
  return server;
};

const trackSocket = (socket) => {
  sockets.push(socket);
  return socket;
};

const connectTracked = async (url, signup) => {
  const connected = await connectSocketForSignup(url, signup);
  trackSocket(connected.socket);
  return connected;
};

const waitForNoMatchingSocketEvent = (
  socket,
  eventName,
  predicate,
  timeoutMs = 700
) => new Promise((resolve) => {
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

const setupScenario = async ({
  showOnlineStatus = false,
  showLastSeen = true,
} = {}) => {
  const server = await startServer();
  const hidden = await signupWithAgent({ firstName: 'Hidden', lastName: 'Presence' });
  const viewer = await signupWithAgent({ firstName: 'Allowed', lastName: 'Viewer' });
  const outsider = await signupWithAgent({ firstName: 'Presence', lastName: 'Outsider' });

  await User.findByIdAndUpdate(hidden.user._id, {
    showOnlineStatus,
    showLastSeen,
    lastSeen: FIXED_LAST_SEEN,
  });
  await createDirectChat([hidden.user, viewer.user]);

  return { server, hidden, viewer, outsider };
};

const findPresence = (ready, userId) => ready.presence.find(
  (entry) => entry.userId === userId.toString()
);

const findHttpContact = (response, userId) => response.body.data.allContacts.find(
  (entry) => entry._id === userId.toString()
);

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

describe('Phase 14 presence and metadata privacy', () => {
  it('does not emit a connection-timing event when online status is hidden', async () => {
    const { server, hidden, viewer } = await setupScenario();
    const viewerConnection = await connectTracked(server.url, viewer);
    const noLeak = waitForNoMatchingSocketEvent(
      viewerConnection.socket,
      'user:status-change',
      (payload) => payload?.userId === hidden.user._id.toString()
    );

    await connectTracked(server.url, hidden);

    await expect(noLeak).resolves.toBeUndefined();
  });

  it('uses the same visible last-seen state while a hidden user is online', async () => {
    const { server, hidden, viewer } = await setupScenario();
    await connectTracked(server.url, hidden);
    const viewerConnection = await connectTracked(server.url, viewer);
    const presence = findPresence(viewerConnection.ready, hidden.user._id);

    expect(presence).toMatchObject({
      userId: hidden.user._id.toString(),
      isOnline: false,
      isCallReachable: false,
      lastSeen: FIXED_LAST_SEEN.toISOString(),
    });
  });

  it('emits a visible last-seen update only when the hidden user goes offline', async () => {
    const { server, hidden, viewer } = await setupScenario();
    const viewerConnection = await connectTracked(server.url, viewer);
    const hiddenConnection = await connectTracked(server.url, hidden);
    const offlineEvent = waitForSocketEvent(
      viewerConnection.socket,
      'user:status-change',
      2_000
    );

    hiddenConnection.socket.disconnect();
    const payload = await offlineEvent;

    expect(payload).toMatchObject({
      userId: hidden.user._id.toString(),
      isOnline: false,
      isCallReachable: false,
    });
    expect(new Date(payload.lastSeen).getTime()).toBeGreaterThan(FIXED_LAST_SEEN.getTime());
  });

  it('emits no connect or disconnect metadata when online and last-seen are both hidden', async () => {
    const { server, hidden, viewer } = await setupScenario({ showLastSeen: false });
    const viewerConnection = await connectTracked(server.url, viewer);
    const noLeak = waitForNoMatchingSocketEvent(
      viewerConnection.socket,
      'user:status-change',
      (payload) => payload?.userId === hidden.user._id.toString(),
      1_200
    );
    const hiddenConnection = await connectTracked(server.url, hidden);

    hiddenConnection.socket.disconnect();

    await expect(noLeak).resolves.toBeUndefined();
  });

  it('normalizes HTTP single-user and contact-list presence without an online-state oracle', async () => {
    const { server, hidden, viewer } = await setupScenario();
    await connectTracked(server.url, hidden);

    const [singleResponse, listResponse] = await Promise.all([
      viewer.agent.get(`/api/user/online-status/${hidden.user._id}`).expect(200),
      viewer.agent.get('/api/user/online-users').expect(200),
    ]);
    const single = singleResponse.body.data;
    const contact = findHttpContact(listResponse, hidden.user._id);

    for (const entry of [single, contact]) {
      expect(entry.isOnline).toBeUndefined();
      expect(entry.isCallReachable).toBeUndefined();
      expect(new Date(entry.lastSeen).toISOString()).toBe(FIXED_LAST_SEEN.toISOString());
    }
    expect(listResponse.body.data.onlineUsers).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _id: hidden.user._id.toString() }),
      ])
    );
  });

  it('does not let a client spoof another user presence transition', async () => {
    const { server, hidden, viewer } = await setupScenario();
    const viewerConnection = await connectTracked(server.url, viewer);
    const hiddenConnection = await connectTracked(server.url, hidden);
    const noSpoof = waitForNoMatchingSocketEvent(
      viewerConnection.socket,
      'user:status-change',
      (payload) => payload?.userId === hidden.user._id.toString()
        && payload?.isOnline === true
    );

    hiddenConnection.socket.emit('user:status-change', {
      userId: hidden.user._id.toString(),
      isOnline: true,
      isCallReachable: true,
    });

    await expect(noSpoof).resolves.toBeUndefined();
  });
});
