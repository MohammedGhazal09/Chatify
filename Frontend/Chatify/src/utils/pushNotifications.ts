import type { PushSubscriptionPayload } from '../types/notifications';

const CHATIFY_SERVICE_WORKER_PATH = '/chatify-service-worker.js';
const CHATIFY_SERVICE_WORKER_SCOPE = '/';
const CHATIFY_CACHE_PREFIX = 'chatify-';
const CLEAR_PRIVATE_STATE_MESSAGE = Object.freeze({
  type: 'CHATIFY_CLEAR_PRIVATE_STATE',
});

type RemoveServerSubscription = (endpoint: string) => Promise<unknown>;

const getVapidPublicKey = () => (
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ?? ''
);

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
};

const supportsServiceWorkers = () => (
  typeof window !== 'undefined'
  && typeof navigator !== 'undefined'
  && 'serviceWorker' in navigator
);

const getChatifyServiceWorkerRegistration = async () => {
  if (!supportsServiceWorkers()) {
    return null;
  }

  try {
    return await navigator.serviceWorker.getRegistration(CHATIFY_SERVICE_WORKER_SCOPE) ?? null;
  } catch {
    return null;
  }
};

const notifyWorkerToClearPrivateState = (registration: ServiceWorkerRegistration | null) => {
  if (!supportsServiceWorkers()) {
    return;
  }

  const workers = [
    registration?.active,
    registration?.waiting,
    registration?.installing,
    navigator.serviceWorker.controller,
  ].filter((worker): worker is ServiceWorker => Boolean(worker));
  const notifiedWorkers = new Set<ServiceWorker>();

  workers.forEach((worker) => {
    if (notifiedWorkers.has(worker)) {
      return;
    }

    notifiedWorkers.add(worker);
    worker.postMessage(CLEAR_PRIVATE_STATE_MESSAGE);
  });
};

const clearOwnedCacheStorage = async () => {
  if (typeof caches === 'undefined') {
    return;
  }

  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith(CHATIFY_CACHE_PREFIX))
        .map((cacheName) => caches.delete(cacheName))
    );
  } catch {
    // Cache cleanup is best effort because privacy state is also cleared by the worker message.
  }
};

export const registerChatifyServiceWorker = async () => {
  if (!supportsServiceWorkers()) {
    throw new Error('Service workers are not available in this browser.');
  }

  const registration = await navigator.serviceWorker.register(
    CHATIFY_SERVICE_WORKER_PATH,
    {
      scope: CHATIFY_SERVICE_WORKER_SCOPE,
      updateViaCache: 'none',
    }
  );

  try {
    await registration.update();
  } catch {
    // Registration remains usable when an immediate update check is temporarily unavailable.
  }

  return registration;
};

export const clearChatifyServiceWorkerPrivateState = async () => {
  const registration = await getChatifyServiceWorkerRegistration();
  notifyWorkerToClearPrivateState(registration);
  await clearOwnedCacheStorage();
};

export const revokeChatifyPushNotifications = async (
  removeServerSubscription?: RemoveServerSubscription
) => {
  const registration = await getChatifyServiceWorkerRegistration();
  let subscription: PushSubscription | null = null;

  try {
    subscription = await registration?.pushManager.getSubscription() ?? null;
  } catch {
    subscription = null;
  }

  const endpoint = subscription?.endpoint ?? null;
  let browserUnsubscribed = false;
  let serverRemoved = false;

  if (subscription) {
    try {
      browserUnsubscribed = await subscription.unsubscribe();
    } catch {
      browserUnsubscribed = false;
    }
  }

  if (endpoint && removeServerSubscription) {
    try {
      await removeServerSubscription(endpoint);
      serverRemoved = true;
    } catch {
      serverRemoved = false;
    }
  }

  await clearChatifyServiceWorkerPrivateState();

  return {
    endpoint,
    browserUnsubscribed,
    serverRemoved,
  };
};

export const getPushNotificationSupportStatus = () => {
  if (
    !supportsServiceWorkers()
    || !('PushManager' in window)
    || !('Notification' in window)
    || typeof ServiceWorkerRegistration === 'undefined'
    || !('showNotification' in ServiceWorkerRegistration.prototype)
  ) {
    return { supported: false, reason: 'unsupported' as const };
  }

  if (!window.isSecureContext) {
    return { supported: false, reason: 'unsupported' as const };
  }

  if (!getVapidPublicKey()) {
    return { supported: false, reason: 'missing_vapid_key' as const };
  }

  return { supported: true, reason: null };
};

export const subscribeToChatifyPushNotifications = async (): Promise<PushSubscriptionPayload> => {
  const support = getPushNotificationSupportStatus();

  if (!support.supported) {
    throw new Error('Push notifications are not available in this browser.');
  }

  const registration = await registerChatifyServiceWorker();
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription = existingSubscription ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(getVapidPublicKey()),
  });
  const serialized = subscription.toJSON();

  if (
    !serialized.endpoint ||
    !serialized.keys?.p256dh ||
    !serialized.keys?.auth
  ) {
    throw new Error('Push subscription is incomplete.');
  }

  return {
    endpoint: serialized.endpoint,
    keys: {
      p256dh: serialized.keys.p256dh,
      auth: serialized.keys.auth,
    },
  };
};
