import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearChatifyServiceWorkerPrivateState,
  registerChatifyServiceWorker,
  revokeChatifyPushNotifications,
} from './pushNotifications';

type MockSubscription = {
  endpoint: string;
  unsubscribe: ReturnType<typeof vi.fn>;
  toJSON: ReturnType<typeof vi.fn>;
};

type MockRegistration = {
  active: { postMessage: ReturnType<typeof vi.fn> };
  waiting: null;
  installing: null;
  update: ReturnType<typeof vi.fn>;
  pushManager: {
    getSubscription: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  };
};

const originalDescriptors = {
  serviceWorker: Object.getOwnPropertyDescriptor(navigator, 'serviceWorker'),
  Notification: Object.getOwnPropertyDescriptor(globalThis, 'Notification'),
  PushManager: Object.getOwnPropertyDescriptor(globalThis, 'PushManager'),
  ServiceWorkerRegistration: Object.getOwnPropertyDescriptor(globalThis, 'ServiceWorkerRegistration'),
  caches: Object.getOwnPropertyDescriptor(globalThis, 'caches'),
  isSecureContext: Object.getOwnPropertyDescriptor(window, 'isSecureContext'),
};

const restoreDescriptor = (target: object, key: PropertyKey, descriptor?: PropertyDescriptor) => {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
  } else {
    Reflect.deleteProperty(target, key);
  }
};

const createBrowserHarness = () => {
  const subscription: MockSubscription = {
    endpoint: 'https://push.example.test/subscriptions/current-browser',
    unsubscribe: vi.fn().mockResolvedValue(true),
    toJSON: vi.fn(() => ({
      endpoint: 'https://push.example.test/subscriptions/current-browser',
      keys: {
        p256dh: 'public-key',
        auth: 'auth-key',
      },
    })),
  };
  const registration: MockRegistration = {
    active: {
      postMessage: vi.fn(),
    },
    waiting: null,
    installing: null,
    update: vi.fn().mockResolvedValue(undefined),
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(subscription),
      subscribe: vi.fn().mockResolvedValue(subscription),
    },
  };
  const register = vi.fn().mockResolvedValue(registration);
  const getRegistration = vi.fn().mockResolvedValue(registration);
  const cacheKeys = vi.fn().mockResolvedValue([
    'chatify-private-v1',
    'chatify-runtime-v2',
    'unrelated-cache',
  ]);
  const deleteCache = vi.fn().mockResolvedValue(true);

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register,
      getRegistration,
      controller: registration.active,
    },
  });
  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    value: {
      permission: 'granted',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    },
  });
  Object.defineProperty(globalThis, 'PushManager', {
    configurable: true,
    value: class MockPushManager {},
  });
  class MockServiceWorkerRegistration {
    showNotification() {}
  }
  Object.defineProperty(globalThis, 'ServiceWorkerRegistration', {
    configurable: true,
    value: MockServiceWorkerRegistration,
  });
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: {
      keys: cacheKeys,
      delete: deleteCache,
    },
  });
  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value: true,
  });

  return {
    subscription,
    registration,
    register,
    getRegistration,
    cacheKeys,
    deleteCache,
  };
};

describe('Phase 17 push and service-worker lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    restoreDescriptor(navigator, 'serviceWorker', originalDescriptors.serviceWorker);
    restoreDescriptor(globalThis, 'Notification', originalDescriptors.Notification);
    restoreDescriptor(globalThis, 'PushManager', originalDescriptors.PushManager);
    restoreDescriptor(
      globalThis,
      'ServiceWorkerRegistration',
      originalDescriptors.ServiceWorkerRegistration
    );
    restoreDescriptor(globalThis, 'caches', originalDescriptors.caches);
    restoreDescriptor(window, 'isSecureContext', originalDescriptors.isSecureContext);
  });

  it('registers the root-scoped worker without using the HTTP cache and checks for updates', async () => {
    const harness = createBrowserHarness();

    await expect(registerChatifyServiceWorker()).resolves.toBe(harness.registration);

    expect(harness.register).toHaveBeenCalledWith('/chatify-service-worker.js', {
      scope: '/',
      updateViaCache: 'none',
    });
    expect(harness.registration.update).toHaveBeenCalledTimes(1);
  });

  it('clears Chatify-owned CacheStorage entries and notifies the active worker', async () => {
    const harness = createBrowserHarness();

    await clearChatifyServiceWorkerPrivateState();

    expect(harness.getRegistration).toHaveBeenCalledWith('/');
    expect(harness.registration.active.postMessage).toHaveBeenCalledWith({
      type: 'CHATIFY_CLEAR_PRIVATE_STATE',
    });
    expect(harness.deleteCache).toHaveBeenCalledWith('chatify-private-v1');
    expect(harness.deleteCache).toHaveBeenCalledWith('chatify-runtime-v2');
    expect(harness.deleteCache).not.toHaveBeenCalledWith('unrelated-cache');
  });

  it('unsubscribes the current browser and removes its endpoint from the authenticated account', async () => {
    const harness = createBrowserHarness();
    const removeServerSubscription = vi.fn().mockResolvedValue(undefined);

    await expect(revokeChatifyPushNotifications(removeServerSubscription)).resolves.toEqual({
      endpoint: harness.subscription.endpoint,
      browserUnsubscribed: true,
      serverRemoved: true,
    });

    expect(harness.subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(removeServerSubscription).toHaveBeenCalledWith(harness.subscription.endpoint);
    expect(harness.registration.active.postMessage).toHaveBeenCalledWith({
      type: 'CHATIFY_CLEAR_PRIVATE_STATE',
    });
  });

  it('still removes the browser subscription and private state when server cleanup fails', async () => {
    const harness = createBrowserHarness();
    const removeServerSubscription = vi.fn().mockRejectedValue(new Error('offline'));

    await expect(revokeChatifyPushNotifications(removeServerSubscription)).resolves.toEqual({
      endpoint: harness.subscription.endpoint,
      browserUnsubscribed: true,
      serverRemoved: false,
    });

    expect(harness.subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(harness.deleteCache).toHaveBeenCalledWith('chatify-private-v1');
  });
});
