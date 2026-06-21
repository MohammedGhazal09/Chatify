import webPush from 'web-push';
import User from '../Models/userModel.mjs';
import NotificationOutbox, {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_OUTBOX_STATUS,
} from '../Models/notificationOutboxModel.mjs';
import { filterUnblockedContactIds } from '../Utils/conversationControls.mjs';
import { toObjectId } from '../Utils/messageState.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';
import {
  isChatMutedForPreferences,
  serializeNotificationPreferences,
} from '../Utils/notificationPreferences.mjs';
import {
  buildChannelMessageNotificationTemplate,
  buildEncryptedMessageNotificationTemplate,
  buildMessageNotificationTemplate,
  NOTIFICATION_CONTEXT_KINDS,
  serializeOutboxPayload,
} from '../Utils/notificationTemplates.mjs';
import { isEncryptedConversation } from '../Utils/encryptionMode.mjs';
import { sendNotificationEmail } from './emailService.mjs';

const DEFAULT_OUTBOX_BATCH_SIZE = 25;
const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000];
const PROVIDER_DRY_RUN = 'dry-run';
const PROVIDER_BREVO = 'brevo';
const PROVIDER_WEB_PUSH = 'web-push';
const sanitizedTextPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|https:\/\/[^\s"']+|Bearer\s+[A-Za-z0-9._~+/=-]+|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gi;

let workerTimer = null;
let webPushConfigured = false;

class NotificationDeliveryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'NotificationDeliveryError';
    this.code = code;
  }
}

const toIdString = (value) => value?._id?.toString?.() ?? value?.toString?.() ?? null;

const shouldDryRunNotifications = () => (
  process.env.CHATIFY_NOTIFICATION_DRY_RUN === '1' ||
  process.env.NODE_ENV === 'test' ||
  process.env.NODE_ENV !== 'production'
);

const sanitizeProviderError = (error) => {
  const code = error?.code ?? error?.name ?? 'provider_error';
  const status = error?.statusCode ?? error?.response?.status;
  const message = String(error?.message ?? 'Notification provider failed')
    .replace(sanitizedTextPattern, '[redacted]')
    .slice(0, 240);

  return [code, status, message].filter(Boolean).join(': ');
};

const logSkip = ({ reason, chatId, recipientId, channel }) => {
  logger.info('notification.delivery_skipped', {
    reason,
    chatId: toIdString(chatId),
    recipientId: toIdString(recipientId),
    channel,
  });
};

const buildDedupeKey = ({ recipientId, messageId, channel, endpointHash = 'default' }) => (
  [
    toIdString(recipientId),
    toIdString(messageId),
    channel,
    endpointHash,
  ].join(':')
);

const createOutboxJob = async ({
  recipientId,
  senderId,
  chatId,
  messageId,
  channel,
  payload,
  pushSubscriptionEndpointHash,
}) => {
  const dedupeKey = buildDedupeKey({
    recipientId,
    messageId,
    channel,
    endpointHash: pushSubscriptionEndpointHash,
  });
  const result = await NotificationOutbox.updateOne(
    { dedupeKey },
    {
      $setOnInsert: {
        dedupeKey,
        recipient: recipientId,
        sender: senderId,
        chatId,
        messageId,
        channel,
        pushSubscriptionEndpointHash,
        payload,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
        nextAttemptAt: new Date(),
      },
    },
    { upsert: true }
  );

  return result.upsertedCount === 1;
};

const getEligibleRecipientIds = async ({ chat, senderId }) => {
  const senderIdString = toIdString(senderId);
  const recipientIds = (chat.members ?? [])
    .map((memberId) => toIdString(memberId))
    .filter((memberId) => memberId && memberId !== senderIdString);

  return filterUnblockedContactIds({
    userId: senderIdString,
    contactIds: recipientIds,
  });
};

const loadNotificationUsers = (recipientIds) => User.find({ _id: { $in: recipientIds } })
  .select('email notificationPreferences');

const buildNotificationContext = (chat) => {
  if (chat?.isSpaceChannel === true) {
    return {
      conversationKind: NOTIFICATION_CONTEXT_KINDS.SPACE_CHANNEL,
      spaceId: toIdString(chat.space),
      channelId: toIdString(chat._id),
    };
  }

  return {
    conversationKind: chat?.isGroupChat === true
      ? NOTIFICATION_CONTEXT_KINDS.GROUP
      : NOTIFICATION_CONTEXT_KINDS.DIRECT,
  };
};

export const enqueueMessageNotifications = async ({ chat, message, senderId }) => {
  const senderObjectId = toObjectId(senderId);
  const chatObjectId = toObjectId(chat?._id);
  const messageObjectId = toObjectId(message?._id);

  if (!senderObjectId || !chatObjectId || !messageObjectId) {
    return { created: 0, skipped: 0 };
  }

  const eligibleRecipientIds = await getEligibleRecipientIds({ chat, senderId: senderObjectId });
  const users = await loadNotificationUsers(eligibleRecipientIds);
  const encryptedNotification = isEncryptedConversation(chat?.encryptionMode) || message?.messageType === 'encrypted';
  const template = encryptedNotification
    ? buildEncryptedMessageNotificationTemplate()
    : chat?.isSpaceChannel === true
      ? buildChannelMessageNotificationTemplate()
      : buildMessageNotificationTemplate();
  const payload = serializeOutboxPayload(template, buildNotificationContext(chat));
  let created = 0;
  let skipped = 0;

  for (const user of users) {
    const preferences = serializeNotificationPreferences(user);
    const recipientId = user._id;

    if (isChatMutedForPreferences(user.notificationPreferences, chatObjectId)) {
      skipped += 1;
      logSkip({
        reason: 'muted_chat',
        chatId: chatObjectId,
        recipientId,
        channel: 'all',
      });
      continue;
    }

    if (preferences.emailNotificationsEnabled) {
      if (preferences.emailUnsubscribed) {
        skipped += 1;
        logSkip({
          reason: 'email_unsubscribed',
          chatId: chatObjectId,
          recipientId,
          channel: NOTIFICATION_CHANNELS.EMAIL,
        });
      } else if (!user.email) {
        skipped += 1;
        logSkip({
          reason: 'email_unavailable',
          chatId: chatObjectId,
          recipientId,
          channel: NOTIFICATION_CHANNELS.EMAIL,
        });
      } else {
        created += await createOutboxJob({
          recipientId,
          senderId: senderObjectId,
          chatId: chatObjectId,
          messageId: messageObjectId,
          channel: NOTIFICATION_CHANNELS.EMAIL,
          payload,
        }) ? 1 : 0;
      }
    } else {
      skipped += 1;
      logSkip({
        reason: 'email_disabled',
        chatId: chatObjectId,
        recipientId,
        channel: NOTIFICATION_CHANNELS.EMAIL,
      });
    }

    if (preferences.pushEnabled) {
      const pushSubscriptions = user.notificationPreferences?.pushSubscriptions ?? [];

      if (pushSubscriptions.length === 0) {
        skipped += 1;
        logSkip({
          reason: 'push_subscription_missing',
          chatId: chatObjectId,
          recipientId,
          channel: NOTIFICATION_CHANNELS.PUSH,
        });
      }

      for (const subscription of pushSubscriptions) {
        created += await createOutboxJob({
          recipientId,
          senderId: senderObjectId,
          chatId: chatObjectId,
          messageId: messageObjectId,
          channel: NOTIFICATION_CHANNELS.PUSH,
          pushSubscriptionEndpointHash: subscription.endpointHash,
          payload,
        }) ? 1 : 0;
      }
    } else {
      skipped += 1;
      logSkip({
        reason: 'push_disabled',
        chatId: chatObjectId,
        recipientId,
        channel: NOTIFICATION_CHANNELS.PUSH,
      });
    }
  }

  if (created > 0) {
    logger.info('notification.outbox_created', {
      chatId: chatObjectId.toString(),
      messageId: messageObjectId.toString(),
      created,
    });
  }

  return { created, skipped };
};

const loadRecipientForDelivery = (recipientId) => User.findById(recipientId)
  .select('email notificationPreferences');

const assertEmailProviderConfigured = () => {
  if (!process.env.BREVO_API_KEY || !process.env.EMAIL_USER_SENDER) {
    throw new NotificationDeliveryError('Email notification provider is not configured', 'email_provider_not_configured');
  }
};

const configureWebPush = () => {
  if (webPushConfigured) {
    return;
  }

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    throw new NotificationDeliveryError('Push notification provider is not configured', 'push_provider_not_configured');
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  webPushConfigured = true;
};

const deliverEmailNotification = async (job) => {
  if (shouldDryRunNotifications()) {
    return { provider: PROVIDER_DRY_RUN, providerStatus: 'dry-run-sent' };
  }

  assertEmailProviderConfigured();

  const user = await loadRecipientForDelivery(job.recipient);

  if (!user?.email) {
    throw new NotificationDeliveryError('Recipient email is unavailable', 'email_unavailable');
  }

  await sendNotificationEmail({
    email: user.email,
    subject: job.payload.subject,
    textContent: job.payload.textContent,
    htmlContent: job.payload.htmlContent,
  });

  return { provider: PROVIDER_BREVO, providerStatus: 'sent' };
};

const findPushSubscription = (user, endpointHash) => (
  (user?.notificationPreferences?.pushSubscriptions ?? [])
    .find((subscription) => subscription.endpointHash === endpointHash)
);

const deliverPushNotification = async (job) => {
  if (shouldDryRunNotifications()) {
    return { provider: PROVIDER_DRY_RUN, providerStatus: 'dry-run-sent' };
  }

  configureWebPush();

  const user = await loadRecipientForDelivery(job.recipient);
  const subscription = findPushSubscription(user, job.pushSubscriptionEndpointHash);

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new NotificationDeliveryError('Push subscription is unavailable', 'push_subscription_unavailable');
  }

  await webPush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    },
    JSON.stringify({
      title: job.payload.title,
      body: job.payload.body,
      url: '/chat',
    })
  );

  return { provider: PROVIDER_WEB_PUSH, providerStatus: 'sent' };
};

const deliverNotificationJob = (job) => {
  if (job.channel === NOTIFICATION_CHANNELS.EMAIL) {
    return deliverEmailNotification(job);
  }

  if (job.channel === NOTIFICATION_CHANNELS.PUSH) {
    return deliverPushNotification(job);
  }

  throw new NotificationDeliveryError('Notification channel is unsupported', 'unsupported_channel');
};

const getNextAttemptAt = (attempts) => {
  const delayMs = RETRY_BACKOFF_MS[Math.min(attempts - 1, RETRY_BACKOFF_MS.length - 1)];
  return new Date(Date.now() + delayMs);
};

export const processNotificationOutbox = async ({ limit = DEFAULT_OUTBOX_BATCH_SIZE } = {}) => {
  const now = new Date();
  const jobs = await NotificationOutbox.find({
    status: NOTIFICATION_OUTBOX_STATUS.PENDING,
    nextAttemptAt: { $lte: now },
    attempts: { $lt: DEFAULT_MAX_ATTEMPTS },
  })
    .sort({ nextAttemptAt: 1, createdAt: 1 })
    .limit(limit);
  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    const attempts = job.attempts + 1;

    await NotificationOutbox.updateOne(
      { _id: job._id, status: NOTIFICATION_OUTBOX_STATUS.PENDING },
      {
        $set: {
          status: NOTIFICATION_OUTBOX_STATUS.PROCESSING,
          lastAttemptAt: new Date(),
        },
      }
    );

    try {
      const result = await deliverNotificationJob(job);

      await NotificationOutbox.updateOne(
        { _id: job._id },
        {
          $set: {
            status: NOTIFICATION_OUTBOX_STATUS.SENT,
            attempts,
            provider: result.provider,
            providerStatus: result.providerStatus,
            sentAt: new Date(),
            sanitizedError: undefined,
          },
        }
      );
      sent += 1;
      logger.info('notification.delivery_succeeded', {
        jobId: job._id.toString(),
        channel: job.channel,
        provider: result.provider,
      });
    } catch (error) {
      const terminal = attempts >= job.maxAttempts;
      const sanitizedError = sanitizeProviderError(error);

      await NotificationOutbox.updateOne(
        { _id: job._id },
        {
          $set: {
            status: terminal
              ? NOTIFICATION_OUTBOX_STATUS.FAILED
              : NOTIFICATION_OUTBOX_STATUS.PENDING,
            attempts,
            provider: job.channel === NOTIFICATION_CHANNELS.EMAIL ? PROVIDER_BREVO : PROVIDER_WEB_PUSH,
            providerStatus: terminal ? 'failed' : 'retry_scheduled',
            nextAttemptAt: terminal ? undefined : getNextAttemptAt(attempts),
            failedAt: terminal ? new Date() : undefined,
            sanitizedError,
          },
        }
      );
      failed += 1;
      logger.warn('notification.delivery_failed', {
        jobId: job._id.toString(),
        channel: job.channel,
        terminal,
        errorCode: error?.code,
      });
    }
  }

  return { processed: jobs.length, sent, failed };
};

export const startNotificationOutboxWorker = () => {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.NOTIFICATION_WORKER_ENABLED === '0' ||
    workerTimer
  ) {
    return null;
  }

  const intervalMs = Number.parseInt(process.env.NOTIFICATION_WORKER_INTERVAL_MS ?? '30000', 10);
  const safeIntervalMs = Number.isFinite(intervalMs) && intervalMs >= 5000
    ? intervalMs
    : 30000;

  workerTimer = setInterval(() => {
    processNotificationOutbox().catch((error) => {
      logger.error('notification.worker_failed', { error });
    });
  }, safeIntervalMs);

  return workerTimer;
};

export const stopNotificationOutboxWorker = () => {
  if (!workerTimer) {
    return;
  }

  clearInterval(workerTimer);
  workerTimer = null;
};

export const resetNotificationOutboxWorkerForTests = () => {
  stopNotificationOutboxWorker();
  webPushConfigured = false;
};
