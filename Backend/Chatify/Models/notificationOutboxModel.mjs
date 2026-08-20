import mongoose from 'mongoose';

export const NOTIFICATION_CHANNELS = Object.freeze({
  EMAIL: 'email',
  PUSH: 'push',
});

export const NOTIFICATION_OUTBOX_STATUS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  SENT: 'sent',
  FAILED: 'failed',
});

const notificationContextSchema = new mongoose.Schema({
  conversationKind: {
    type: String,
    enum: ['direct', 'group', 'space_channel'],
  },
  spaceId: {
    type: String,
    trim: true,
  },
  channelId: {
    type: String,
    trim: true,
  },
  channelName: {
    type: String,
    trim: true,
    maxlength: 80,
  },
}, {
  _id: false,
  versionKey: false,
});

const notificationPayloadSchema = new mongoose.Schema({
  templateKey: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 120,
  },
  body: {
    type: String,
    required: true,
    maxlength: 240,
  },
  subject: {
    type: String,
    maxlength: 160,
  },
  textContent: {
    type: String,
    maxlength: 1000,
  },
  htmlContent: {
    type: String,
    maxlength: 2000,
  },
  context: notificationContextSchema,
}, {
  _id: false,
  versionKey: false,
});

const notificationOutboxSchema = new mongoose.Schema({
  dedupeKey: {
    type: String,
    required: true,
    unique: true,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chats',
    required: true,
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Messages',
    required: true,
  },
  channel: {
    type: String,
    enum: Object.values(NOTIFICATION_CHANNELS),
    required: true,
  },
  eventType: {
    type: String,
    enum: ['message'],
    default: 'message',
  },
  pushSubscriptionEndpointHash: {
    type: String,
  },
  payload: {
    type: notificationPayloadSchema,
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(NOTIFICATION_OUTBOX_STATUS),
    default: NOTIFICATION_OUTBOX_STATUS.PENDING,
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0,
  },
  maxAttempts: {
    type: Number,
    default: 3,
    min: 1,
    max: 10,
  },
  nextAttemptAt: {
    type: Date,
    default: Date.now,
  },
  lastAttemptAt: {
    type: Date,
  },
  sentAt: {
    type: Date,
  },
  failedAt: {
    type: Date,
  },
  provider: {
    type: String,
  },
  providerStatus: {
    type: String,
  },
  sanitizedError: {
    type: String,
    maxlength: 500,
  },
}, {
  timestamps: true,
  versionKey: false,
});

notificationOutboxSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
notificationOutboxSchema.index({ recipient: 1, chatId: 1, createdAt: -1 });
notificationOutboxSchema.index({ messageId: 1, channel: 1 });

const NotificationOutbox = mongoose.model('NotificationOutbox', notificationOutboxSchema);

export default NotificationOutbox;
