import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canRequestBrowserNotificationPermission,
  getBrowserNotificationPermission,
  getSafeNotificationCopy,
  requestBrowserNotificationPermission,
} from './notificationPrivacy';

const originalNotification = window.Notification;

const installNotificationMock = (
  permission: NotificationPermission,
  requestPermission = vi.fn<() => Promise<NotificationPermission>>()
) => {
  const NotificationMock = {
    permission,
    requestPermission,
  } as unknown as typeof Notification;

  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: NotificationMock,
  });

  return requestPermission;
};

describe('notification privacy helpers', () => {
  afterEach(() => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: originalNotification,
    });
    vi.restoreAllMocks();
  });

  it('formats browser notification copy without echoing private message inputs', () => {
    const privateMarkers = [
      'INPUT_ALPHA_MARKER',
      'INPUT_BETA_MARKER',
      'INPUT_GAMMA_MARKER',
    ];

    const copy = getSafeNotificationCopy({
      eventType: 'message',
      senderName: privateMarkers[2],
      messageText: privateMarkers[0],
      attachmentNames: [privateMarkers[1]],
    });

    expect(copy).toEqual({
      title: 'New Chatify message',
      body: 'Open Chatify to read it.',
    });
    privateMarkers.forEach((marker) => {
      expect(copy.title).not.toContain(marker);
      expect(copy.body).not.toContain(marker);
    });
  });

  it('uses generic call copy without exposing call participants', () => {
    const copy = getSafeNotificationCopy({
      eventType: 'call',
      senderName: 'INPUT_CALLER_MARKER',
    });

    expect(copy).toEqual({
      title: 'Chatify call update',
      body: 'Open Chatify to respond.',
    });
    expect(`${copy.title} ${copy.body}`).not.toContain('INPUT_CALLER_MARKER');
  });

  it('reports unsupported browser notification state without requesting permission', () => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: undefined,
    });

    expect(getBrowserNotificationPermission()).toBe('unsupported');
    expect(canRequestBrowserNotificationPermission()).toBe(false);
  });

  it('reads default permission without prompting on permission-state checks', () => {
    const requestPermission = installNotificationMock('default');

    expect(getBrowserNotificationPermission()).toBe('default');
    expect(canRequestBrowserNotificationPermission()).toBe(true);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('requests browser notification permission only when explicitly called', async () => {
    const requestPermission = installNotificationMock(
      'default',
      vi.fn(async () => 'granted' as NotificationPermission)
    );

    await expect(requestBrowserNotificationPermission()).resolves.toBe('granted');
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });
});
