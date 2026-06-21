import type { PushSubscriptionPayload } from '../types/notifications';

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

export const getPushNotificationSupportStatus = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, reason: 'unsupported' as const };
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
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

  const registration = await navigator.serviceWorker.register('/chatify-service-worker.js');
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
