export type BrowserNotificationPermissionState = NotificationPermission | 'unsupported';

export type NotificationEventType = 'message' | 'call' | 'system';

export interface NotificationPreferences {
  soundEnabled: boolean;
  browserNotificationsEnabled: boolean;
  pushEnabled: boolean;
  emailNotificationsEnabled: boolean;
  messagePreviewMode: 'none';
  emailUnsubscribed: boolean;
  pushSubscriptionCount: number;
  mutedChatIds: string[];
}

export type NotificationPreferencePatch = Partial<Pick<
  NotificationPreferences,
  'pushEnabled' | 'emailNotificationsEnabled' | 'messagePreviewMode' | 'mutedChatIds'
>>;

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface SafeNotificationCopyInput {
  eventType?: NotificationEventType;
  senderName?: string | null;
  messageText?: string | null;
  attachmentNames?: string[];
}

export interface SafeNotificationCopy {
  title: string;
  body: string;
}
