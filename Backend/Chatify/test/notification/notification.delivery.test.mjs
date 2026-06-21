import { afterEach, describe, expect, it } from 'vitest';
import NotificationOutbox, { NOTIFICATION_CHANNELS } from '../../Models/notificationOutboxModel.mjs';
import Message from '../../Models/messageModel.mjs';
import User from '../../Models/userModel.mjs';
import { processNotificationOutbox, resetNotificationOutboxWorkerForTests } from '../../Services/notificationService.mjs';
import { buildMessageNotificationTemplate, serializeOutboxPayload } from '../../Utils/notificationTemplates.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  CHATIFY_NOTIFICATION_DRY_RUN: process.env.CHATIFY_NOTIFICATION_DRY_RUN,
  BREVO_API_KEY: process.env.BREVO_API_KEY,
};

const createEmailOutboxJob = async ({ maxAttempts = 3 } = {}) => {
  await NotificationOutbox.init();
  const sender = await signupWithAgent({ firstName: 'Delivery', lastName: 'Sender' });
  const recipient = await signupWithAgent({ firstName: 'Delivery', lastName: 'Recipient' });
  const chat = await createDirectChat([sender.user, recipient.user]);
  const message = await Message.create({
    chatId: chat._id,
    sender: sender.user._id,
    clientMessageId: 'delivery-message-1',
    text: 'Delivery private marker',
    status: 'sent',
  });
  const template = buildMessageNotificationTemplate();

  return NotificationOutbox.create({
    dedupeKey: `${recipient.user._id}:${message._id}:email:default`,
    recipient: recipient.user._id,
    sender: sender.user._id,
    chatId: chat._id,
    messageId: message._id,
    channel: NOTIFICATION_CHANNELS.EMAIL,
    payload: serializeOutboxPayload(template),
    maxAttempts,
  });
};

describe('notification outbox delivery', () => {
  afterEach(() => {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.CHATIFY_NOTIFICATION_DRY_RUN = originalEnv.CHATIFY_NOTIFICATION_DRY_RUN;
    process.env.BREVO_API_KEY = originalEnv.BREVO_API_KEY;
    resetNotificationOutboxWorkerForTests();
  });

  it('marks local/test delivery as dry-run sent without provider network calls', async () => {
    const job = await createEmailOutboxJob();

    const result = await processNotificationOutbox();
    const delivered = await NotificationOutbox.findById(job._id).lean();

    expect(result).toEqual({ processed: 1, sent: 1, failed: 0 });
    expect(delivered).toMatchObject({
      status: 'sent',
      provider: 'dry-run',
      providerStatus: 'dry-run-sent',
      attempts: 1,
    });
  });

  it('fails closed with a sanitized provider error when production email config is missing', async () => {
    const job = await createEmailOutboxJob({ maxAttempts: 1 });
    process.env.NODE_ENV = 'production';
    process.env.CHATIFY_NOTIFICATION_DRY_RUN = '0';
    delete process.env.BREVO_API_KEY;

    const result = await processNotificationOutbox();
    const failed = await NotificationOutbox.findById(job._id).lean();
    const serialized = JSON.stringify(failed);
    const recipient = await User.findById(job.recipient).lean();

    expect(result).toEqual({ processed: 1, sent: 0, failed: 1 });
    expect(failed).toMatchObject({
      status: 'failed',
      provider: 'brevo',
      providerStatus: 'failed',
      attempts: 1,
    });
    expect(failed.sanitizedError).toContain('email_provider_not_configured');
    expect(serialized).not.toContain(recipient.email);
  });
});
