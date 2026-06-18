export type BrowserNotificationPermissionState = NotificationPermission | 'unsupported';

export type NotificationEventType = 'message' | 'call' | 'system';

export interface NotificationPreferences {
  soundEnabled: boolean;
  browserNotificationsEnabled: boolean;
  mutedChatIds: string[];
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
