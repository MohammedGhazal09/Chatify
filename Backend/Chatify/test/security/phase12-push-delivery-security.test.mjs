import https from 'node:https';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const webPushMocks = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}));

vi.mock('web-push', () => ({
  default: {
    sendNotification: webPushMocks.sendNotification,
    setVapidDetails: webPushMocks.setVapidDetails,
  },
}));

import NotificationOutbox, {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_OUTBOX_STATUS,
} from '../../Models/notificationOutboxModel.mjs';
import User from '../../Models/userModel.mjs';
import {
  processNotificationOutbox,
  resetNotificationOutboxWorkerForTests,
} from '../../Services/notificationService.mjs';
import { hashPushEndpoint } from '../../Utils/notificationPreferences.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
};

const restoreEnv = (key, value) => {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
};

const createPushJob = async ({ endpoint, suffix }) => {
  const sender = await signupWithAgent({ firstName: 'Push', lastName: `Sender ${suffix}` });
  const recipient = await signupWithAgent({ firstName: 'Push', lastName: `Recipient ${suffix}` });
  const endpointHash = hashPushEndpoint(endpoint);

  await User.updateOne(
    { _id: recipient.user._id },
    {
      $set: {
        'notificationPreferences.pushEnabled': true,
        'notificationPreferences.pushSubscriptions': [{
          endpoint,
          endpointHash,
          keys: {
            p256dh: 'public-key-material',
            auth: 'auth-secret-material',
          },
        }],
      },
    }
  );

  const job = await NotificationOutbox.create({
    dedupeKey: `phase12:${suffix}`,
    recipient: recipient.user._id,
    sender: sender.user._id,
    chatId: recipient.user._id,
    messageId: sender.user._id,
    channel: NOTIFICATION_CHANNELS.PUSH,
    pushSubscriptionEndpointHash: endpointHash,
    payload: {
      templateKey: 'message.generic',
      title: 'New Chatify message',
      body: 'Open Chatify to read it.',
      context: {
        conversationKind: 'direct',
      },
    },
  });

  return { recipient, job, endpointHash };
};

const enableProductionDelivery = () => {
  process.env.NODE_ENV = 'production';
};

describe('Phase 12 push delivery security', () => {
  beforeEach(() => {
    webPushMocks.sendNotification.mockReset();
    webPushMocks.setVapidDetails.mockReset();
    process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV ?? 'test';
    process.env.VAPID_SUBJECT = 'mailto:security@example.test';
    process.env.VAPID_PUBLIC_KEY = 'phase-12-public-key';
    process.env.VAPID_PRIVATE_KEY = 'phase-12-private-key';
    resetNotificationOutboxWorkerForTests();
  });

  afterEach(() => {
    resetNotificationOutboxWorkerForTests();
    restoreEnv('NODE_ENV', ORIGINAL_ENV.NODE_ENV);
    restoreEnv('VAPID_SUBJECT', ORIGINAL_ENV.VAPID_SUBJECT);
    restoreEnv('VAPID_PUBLIC_KEY', ORIGINAL_ENV.VAPID_PUBLIC_KEY);
    restoreEnv('VAPID_PRIVATE_KEY', ORIGINAL_ENV.VAPID_PRIVATE_KEY);
  });

  it('sends through a restricted HTTPS agent with a bounded timeout and TTL', async () => {
    const endpoint = 'https://push.example.test/subscriptions/recipient';
    const { job } = await createPushJob({ endpoint, suffix: 'bounded-delivery' });
    webPushMocks.sendNotification.mockResolvedValue({ statusCode: 201 });
    enableProductionDelivery();

    await expect(processNotificationOutbox()).resolves.toEqual({
      processed: 1,
      sent: 1,
      failed: 0,
    });

    expect(webPushMocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(webPushMocks.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint }),
      JSON.stringify({
        title: 'New Chatify message',
        body: 'Open Chatify to read it.',
        url: '/chat',
      }),
      expect.objectContaining({
        agent: expect.any(https.Agent),
        timeout: 10_000,
        TTL: 60,
      })
    );
    await expect(NotificationOutbox.findById(job._id).lean()).resolves.toMatchObject({
      status: NOTIFICATION_OUTBOX_STATUS.SENT,
      attempts: 1,
      provider: 'web-push',
    });
  });

  it('removes expired provider subscriptions and does not retry a 404 or 410 response', async () => {
    const endpoint = 'https://push.example.test/subscriptions/expired';
    const { recipient, job } = await createPushJob({ endpoint, suffix: 'expired-subscription' });
    webPushMocks.sendNotification.mockRejectedValue(Object.assign(
      new Error('Received unexpected response code'),
      { statusCode: 410 }
    ));
    enableProductionDelivery();

    await expect(processNotificationOutbox()).resolves.toEqual({
      processed: 1,
      sent: 0,
      failed: 1,
    });

    await expect(NotificationOutbox.findById(job._id).lean()).resolves.toMatchObject({
      status: NOTIFICATION_OUTBOX_STATUS.FAILED,
      attempts: 1,
      providerStatus: 'failed',
    });
    const storedUser = await User.findById(recipient.user._id).select('notificationPreferences');
    expect(storedUser.notificationPreferences.pushSubscriptions).toHaveLength(0);
  });

  it('quarantines legacy unsafe endpoints before contacting the push provider', async () => {
    const endpoint = 'https://127.0.0.1/internal-control-plane';
    const { recipient, job } = await createPushJob({ endpoint, suffix: 'legacy-unsafe' });
    enableProductionDelivery();

    await expect(processNotificationOutbox()).resolves.toEqual({
      processed: 1,
      sent: 0,
      failed: 1,
    });

    expect(webPushMocks.sendNotification).not.toHaveBeenCalled();
    await expect(NotificationOutbox.findById(job._id).lean()).resolves.toMatchObject({
      status: NOTIFICATION_OUTBOX_STATUS.FAILED,
      attempts: 1,
      providerStatus: 'failed',
    });
    const storedUser = await User.findById(recipient.user._id).select('notificationPreferences');
    expect(storedUser.notificationPreferences.pushSubscriptions).toHaveLength(0);
  });
});
