import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const serviceWorkerSource = readFileSync(
  resolve('Frontend/Chatify/public/chatify-service-worker.js'),
  'utf8'
);

const createHarness = () => {
  const listeners = new Map();
  const notifications = [];
  const openedWindows = [];
  const navigations = [];
  const deletedCaches = [];
  const focusedClients = [];
  const cacheNames = ['chatify-private-v1', 'chatify-runtime-v2', 'unrelated-cache'];
  let claimed = false;
  let skippedWaiting = false;

  const windowClient = {
    url: 'https://chatify.example.test/chat',
    focus: async () => {
      focusedClients.push(true);
      return windowClient;
    },
    navigate: async (url) => {
      navigations.push(url);
      return windowClient;
    },
  };

  const self = {
    location: {
      origin: 'https://chatify.example.test',
    },
    registration: {
      showNotification: async (title, options) => {
        notifications.push({ title, options });
      },
    },
    clients: {
      claim: async () => {
        claimed = true;
      },
      matchAll: async () => [windowClient],
      openWindow: async (url) => {
        openedWindows.push(url);
        return windowClient;
      },
    },
    skipWaiting: async () => {
      skippedWaiting = true;
    },
    addEventListener: (type, handler) => {
      listeners.set(type, handler);
    },
  };

  const caches = {
    keys: async () => [...cacheNames],
    delete: async (name) => {
      deletedCaches.push(name);
      return true;
    },
  };

  vm.runInNewContext(serviceWorkerSource, {
    self,
    caches,
    URL,
    Promise,
    JSON,
    String,
    Array,
    Object,
    Number,
    console,
  }, {
    filename: 'chatify-service-worker.js',
  });

  const dispatch = async (type, event = {}) => {
    const listener = listeners.get(type);
    assert.equal(typeof listener, 'function', `Expected ${type} listener`);
    const pending = [];
    listener({
      ...event,
      waitUntil: (promise) => pending.push(Promise.resolve(promise)),
    });
    await Promise.all(pending);
  };

  return {
    listeners,
    notifications,
    openedWindows,
    navigations,
    deletedCaches,
    focusedClients,
    dispatch,
    get claimed() {
      return claimed;
    },
    get skippedWaiting() {
      return skippedWaiting;
    },
  };
};

test('Phase 17 service worker activates immediately, clears legacy private caches, and never intercepts fetches', async () => {
  const harness = createHarness();

  assert.equal(harness.listeners.has('fetch'), false);
  await harness.dispatch('install');
  await harness.dispatch('activate');

  assert.equal(harness.skippedWaiting, true);
  assert.equal(harness.claimed, true);
  assert.deepEqual(
    harness.deletedCaches.sort(),
    ['chatify-private-v1', 'chatify-runtime-v2']
  );
});

test('Phase 17 push handling bounds display text and rejects external notification destinations', async () => {
  const harness = createHarness();
  const unsafeTitle = `  ${'T'.repeat(200)}\nspoofed  `;
  const unsafeBody = `${'B'.repeat(500)}\u0000hidden`;

  await harness.dispatch('push', {
    data: {
      json: () => ({
        title: unsafeTitle,
        body: unsafeBody,
        url: 'https://attacker.example/steal',
        token: 'MUST_NOT_REACH_NOTIFICATION_DATA',
      }),
    },
  });

  assert.equal(harness.notifications.length, 1);
  const notification = harness.notifications[0];
  assert.equal(notification.title.length <= 80, true);
  assert.equal(notification.title.includes('\n'), false);
  assert.equal(notification.options.body.length <= 180, true);
  assert.equal(notification.options.body.includes('\u0000'), false);
  assert.equal(notification.options.data.url, '/');
  assert.equal(JSON.stringify(notification.options).includes('MUST_NOT_REACH_NOTIFICATION_DATA'), false);
});

test('Phase 17 notification clicks navigate only to same-origin local application paths', async () => {
  const harness = createHarness();
  let closed = false;

  await harness.dispatch('notificationclick', {
    notification: {
      data: {
        url: '//attacker.example/steal',
      },
      close: () => {
        closed = true;
      },
    },
  });

  assert.equal(closed, true);
  assert.deepEqual(harness.navigations, ['https://chatify.example.test/']);
  assert.deepEqual(harness.openedWindows, []);
  assert.equal(harness.focusedClients.length, 1);

  const localHarness = createHarness();
  await localHarness.dispatch('notificationclick', {
    notification: {
      data: {
        url: '/chat?workspace=spaces#current',
      },
      close: () => {},
    },
  });

  assert.deepEqual(
    localHarness.navigations,
    ['https://chatify.example.test/chat?workspace=spaces#current']
  );
});

test('Phase 17 private-state messages clear only Chatify-owned caches', async () => {
  const harness = createHarness();

  await harness.dispatch('message', {
    data: {
      type: 'CHATIFY_CLEAR_PRIVATE_STATE',
    },
  });

  assert.deepEqual(
    harness.deletedCaches.sort(),
    ['chatify-private-v1', 'chatify-runtime-v2']
  );
  assert.equal(harness.deletedCaches.includes('unrelated-cache'), false);
});
