import type {
  BrowserNotificationPermissionState,
  SafeNotificationCopy,
  SafeNotificationCopyInput,
} from '../types/notifications';

const DEFAULT_NOTIFICATION_COPY: SafeNotificationCopy = {
  title: 'New Chatify message',
  body: 'Open Chatify to read it.',
};

const CALL_NOTIFICATION_COPY: SafeNotificationCopy = {
  title: 'Chatify call update',
  body: 'Open Chatify to respond.',
};

export const getSafeNotificationCopy = (
  input: SafeNotificationCopyInput = {}
): SafeNotificationCopy => {
  if (input.eventType === 'call') {
    return CALL_NOTIFICATION_COPY;
  }

  return DEFAULT_NOTIFICATION_COPY;
};

const getBrowserNotificationConstructor = (): typeof Notification | null => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  return window.Notification;
};

export const getBrowserNotificationPermission = (): BrowserNotificationPermissionState => {
  const NotificationConstructor = getBrowserNotificationConstructor();

  return NotificationConstructor?.permission ?? 'unsupported';
};

export const canRequestBrowserNotificationPermission = () => (
  getBrowserNotificationPermission() === 'default'
);

export const requestBrowserNotificationPermission = async (): Promise<BrowserNotificationPermissionState> => {
  const NotificationConstructor = getBrowserNotificationConstructor();

  if (!NotificationConstructor || typeof NotificationConstructor.requestPermission !== 'function') {
    return 'unsupported';
  }

  try {
    return await NotificationConstructor.requestPermission();
  } catch {
    return getBrowserNotificationPermission();
  }
};
