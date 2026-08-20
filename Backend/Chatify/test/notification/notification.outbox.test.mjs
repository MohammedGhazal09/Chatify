import { describe, expect, it } from 'vitest';
import Message from '../../Models/messageModel.mjs';
import NotificationOutbox, { NOTIFICATION_CHANNELS } from '../../Models/notificationOutboxModel.mjs';
import Chats from '../../Models/chatModel.mjs';
import Spaces from '../../Models/spaceModel.mjs';
import User from '../../Models/userModel.mjs';
import UserBlock from '../../Models/userBlockModel.mjs';
import { enqueueMessageNotifications } from '../../Services/notificationService.mjs';
import { hashPushEndpoint } from '../../Utils/notificationPreferences.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const setupNotificationChat = async ({ chatOverrides = {}, messageOverrides = {} } = {}) => {
  await NotificationOutbox.init();
  await UserBlock.init();

  const sender = await signupWithAgent({ firstName: 'Sender', lastName: 'Notify' });
  const recipient = await signupWithAgent({ firstName: 'Recipient', lastName: 'Notify' });
  const chat = await createDirectChat([sender.user, recipient.user], chatOverrides);
  const message = await Message.create({
    chatId: chat._id,
    sender: sender.user._id,
    clientMessageId: 'notification-message-1',
    text: 'PRIVATE_MESSAGE_MARKER',
    status: 'sent',
    ...messageOverrides,
  });

  return { sender, recipient, chat, message };
};

const enableEmailNotifications = (userId, overrides = {}) => User.updateOne(
  { _id: userId },
  {
    $set: {
      'notificationPreferences.emailNotificationsEnabled': true,
      'notificationPreferences.pushEnabled': false,
      ...overrides,
    },
  }
);

describe('notification outbox enqueue', () => {
  it('creates one generic email job and dedupes repeated enqueue calls', async () => {
    const { sender, recipient, chat, message } = await setupNotificationChat();
    await enableEmailNotifications(recipient.user._id);

    await enqueueMessageNotifications({ chat, message, senderId: sender.user._id });
    await enqueueMessageNotifications({ chat, message, senderId: sender.user._id });

    const jobs = await NotificationOutbox.find({}).lean();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      recipient: recipient.user._id,
      sender: sender.user._id,
      channel: NOTIFICATION_CHANNELS.EMAIL,
      status: 'pending',
    });
    expect(JSON.stringify(jobs[0].payload)).toContain('Open Chatify to read it.');
    expect(JSON.stringify(jobs[0])).not.toContain('PRIVATE_MESSAGE_MARKER');
    expect(JSON.stringify(jobs[0])).not.toContain(recipient.payload.email);
  });

  it('skips muted chats before enqueue', async () => {
    const { sender, recipient, chat, message } = await setupNotificationChat();
    await enableEmailNotifications(recipient.user._id, {
      'notificationPreferences.mutedChatIds': [chat._id],
    });

    const result = await enqueueMessageNotifications({ chat, message, senderId: sender.user._id });

    expect(result.created).toBe(0);
    await expect(NotificationOutbox.countDocuments()).resolves.toBe(0);
  });

  it('uses generic encrypted notification copy without storing message plaintext', async () => {
    const { sender, recipient, chat, message } = await setupNotificationChat({
      chatOverrides: { encryptionMode: 'e2ee_v1' },
      messageOverrides: {
        clientMessageId: 'notification-encrypted-message-1',
        text: '',
        messageType: 'encrypted',
        encryptionMode: 'e2ee_v1',
        encryptedPayload: {
          ciphertext: 'PRIVATE_CIPHERTEXT_MARKER',
          iv: 'base64-iv',
          authTag: 'base64-auth-tag',
          algorithm: 'AES-GCM',
          keyVersion: 1,
          senderDeviceId: 'sender-device-1',
          encryptedAt: new Date('2026-06-20T00:00:00.000Z'),
        },
      },
    });
    await enableEmailNotifications(recipient.user._id);

    await enqueueMessageNotifications({ chat, message, senderId: sender.user._id });

    const job = await NotificationOutbox.findOne({ channel: NOTIFICATION_CHANNELS.EMAIL }).lean();
    expect(job.payload).toMatchObject({
      templateKey: 'message.encrypted',
      title: 'New encrypted Chatify message',
    });
    expect(JSON.stringify(job.payload)).toContain('conversation secret');
    expect(JSON.stringify(job)).not.toContain('PRIVATE_CIPHERTEXT_MARKER');
    expect(JSON.stringify(job)).not.toContain(recipient.payload.email);
  });

  it('uses privacy-safe channel notification copy without storing channel message text', async () => {
    await NotificationOutbox.init();
    await Spaces.init();
    await Chats.init();

    const sender = await signupWithAgent({ firstName: 'Channel', lastName: 'Sender' });
    const recipient = await signupWithAgent({ firstName: 'Channel', lastName: 'Recipient' });
    const created = await sender.agent
      .post('/api/space')
      .send({
        name: 'Private Launch Space',
        memberUsernames: [recipient.user.username],
      })
      .expect(201);
    const spaceId = created.body.data.space._id;
    const channelId = created.body.data.channel._id;
    await enableEmailNotifications(recipient.user._id);

    await sender.agent
      .post('/api/message/new-message')
      .send({
        chatId: channelId,
        text: 'CHANNEL_PRIVATE_MESSAGE_MARKER',
        clientMessageId: 'notification-channel-message-1',
      })
      .expect(201);

    const job = await NotificationOutbox.findOne({ channel: NOTIFICATION_CHANNELS.EMAIL }).lean();
    expect(job.payload).toMatchObject({
      templateKey: 'message.channel.generic',
      title: 'New Chatify channel message',
      body: 'Open Chatify to read it.',
      context: {
        conversationKind: 'space_channel',
        spaceId,
        channelId,
      },
    });
    expect(JSON.stringify(job)).not.toContain('CHANNEL_PRIVATE_MESSAGE_MARKER');
    expect(JSON.stringify(job)).not.toContain('Private Launch Space');
    expect(JSON.stringify(job.payload.context)).not.toContain('general');
    expect(JSON.stringify(job)).not.toContain(recipient.payload.email);
    expect(JSON.stringify(job)).not.toContain(sender.payload.email);
  });

  it('skips blocked direct peers before enqueue', async () => {
    const { sender, recipient, chat, message } = await setupNotificationChat();
    await enableEmailNotifications(recipient.user._id);
    await UserBlock.create({
      blocker: recipient.user._id,
      blockedUser: sender.user._id,
      sourceChatId: chat._id,
    });

    const result = await enqueueMessageNotifications({ chat, message, senderId: sender.user._id });

    expect(result.created).toBe(0);
    await expect(NotificationOutbox.countDocuments()).resolves.toBe(0);
  });

  it('creates push jobs per registered subscription without storing push endpoints in the outbox', async () => {
    const { sender, recipient, chat, message } = await setupNotificationChat();
    const endpoint = 'https://push.example.test/subscription/recipient';
    await User.updateOne(
      { _id: recipient.user._id },
      {
        $set: {
          'notificationPreferences.emailNotificationsEnabled': false,
          'notificationPreferences.pushEnabled': true,
          'notificationPreferences.pushSubscriptions': [{
            endpoint,
            endpointHash: hashPushEndpoint(endpoint),
            keys: {
              p256dh: 'public-key-material',
              auth: 'auth-secret-material',
            },
          }],
        },
      }
    );

    await enqueueMessageNotifications({ chat, message, senderId: sender.user._id });

    const job = await NotificationOutbox.findOne({ channel: NOTIFICATION_CHANNELS.PUSH }).lean();
    expect(job).toBeTruthy();
    expect(job.pushSubscriptionEndpointHash).toBe(hashPushEndpoint(endpoint));
    expect(JSON.stringify(job)).not.toContain(endpoint);
  });

  it('does not add outbox jobs for idempotent message retries', async () => {
    const { sender, recipient, chat } = await setupNotificationChat();
    await enableEmailNotifications(recipient.user._id);
    const payload = {
      chatId: chat._id.toString(),
      text: 'Idempotent notify once',
      clientMessageId: 'notification-idempotent-once',
    };

    await sender.agent
      .post('/api/message/new-message')
      .send(payload)
      .expect(201);
    await sender.agent
      .post('/api/message/new-message')
      .send(payload)
      .expect(200);

    await expect(NotificationOutbox.countDocuments({
      recipient: recipient.user._id,
      channel: NOTIFICATION_CHANNELS.EMAIL,
    })).resolves.toBe(1);
  });
});
