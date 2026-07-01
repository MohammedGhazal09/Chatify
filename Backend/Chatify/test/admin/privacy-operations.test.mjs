import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app.mjs';
import NotificationOutbox, {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_OUTBOX_STATUS,
} from '../../Models/notificationOutboxModel.mjs';
import PasswordReset from '../../Models/passwordResetModel.mjs';
import PrivacyRequest, {
  PRIVACY_REQUEST_ACTIONS,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
} from '../../Models/privacyRequestModel.mjs';
import User from '../../Models/userModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createMessage } from '../fixtures/messages.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const now = new Date();
const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const daysFromNow = (days) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

const setupAdminScenario = async () => {
  const admin = await signupWithAgent({
    firstName: 'Privacy',
    lastName: 'Admin',
    username: 'privacy.admin',
    email: 'privacy-admin@example.test',
  });
  const owner = await signupWithAgent({
    firstName: 'Privacy',
    lastName: 'Owner',
    username: 'privacy.owner',
    email: 'privacy-owner@example.test',
  });
  const peer = await signupWithAgent({
    firstName: 'Privacy',
    lastName: 'Peer',
    username: 'privacy.admin.peer',
    email: 'privacy-admin-peer@example.test',
  });
  await User.findByIdAndUpdate(admin.user._id, { role: 'admin' });

  await PrivacyRequest.create({
    user: owner.user._id,
    type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
    status: PRIVACY_REQUEST_STATUSES.PENDING,
    requestedAt: daysAgo(20),
    scheduledFor: daysAgo(1),
    retentionSummary: {},
    events: [{
      action: PRIVACY_REQUEST_ACTIONS.DELETION_REQUESTED,
      actor: owner.user._id,
      metadata: {},
    }],
  });
  await PrivacyRequest.create({
    user: peer.user._id,
    type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
    status: PRIVACY_REQUEST_STATUSES.PENDING,
    requestedAt: daysAgo(1),
    scheduledFor: daysFromNow(13),
    retentionSummary: {},
    events: [{
      action: PRIVACY_REQUEST_ACTIONS.DELETION_REQUESTED,
      actor: peer.user._id,
      metadata: {},
    }],
  });
  await PrivacyRequest.create({
    user: owner.user._id,
    type: PRIVACY_REQUEST_TYPES.ACCOUNT_EXPORT,
    status: PRIVACY_REQUEST_STATUSES.COMPLETED,
    requestedAt: daysAgo(10),
    completedAt: daysAgo(10),
    expiresAt: daysAgo(1),
    events: [{
      action: PRIVACY_REQUEST_ACTIONS.EXPORT_CREATED,
      actor: owner.user._id,
      metadata: { recordCounts: { messages: 1 } },
    }],
  });
  await PasswordReset.create({
    userId: owner.user._id,
    email: owner.user.email,
    tokenHash: 'admin-expired-reset-token',
    expiresAt: daysAgo(1),
  });

  const chat = await createDirectChat([owner.user, peer.user]);
  const message = await createMessage({
    chat,
    sender: owner.user,
    text: 'private admin diagnostic message should not leak',
  });
  const outbox = await NotificationOutbox.create({
    dedupeKey: `admin-privacy-operation-${message._id}`,
    recipient: peer.user._id,
    sender: owner.user._id,
    chatId: chat._id,
    messageId: message._id,
    channel: NOTIFICATION_CHANNELS.EMAIL,
    status: NOTIFICATION_OUTBOX_STATUS.SENT,
    attempts: 1,
    payload: {
      templateKey: 'message',
      title: 'Private notification title',
      body: 'private notification preview should not leak',
    },
  });
  await NotificationOutbox.updateOne(
    { _id: outbox._id },
    { $set: { createdAt: daysAgo(45), updatedAt: daysAgo(45) } },
    { timestamps: false }
  );

  return { admin, owner };
};

describe('admin privacy operations diagnostics', () => {
  it('requires authentication and admin access', async () => {
    await request(app)
      .get('/api/admin/privacy-operations')
      .expect(401);

    const normalUser = await signupWithAgent({
      firstName: 'Privacy',
      lastName: 'Normal',
      username: 'privacy.normal',
    });

    await normalUser.agent
      .get('/api/admin/privacy-operations')
      .expect(403);
  });

  it('returns aggregate privacy operation health without private payloads', async () => {
    const { admin, owner } = await setupAdminScenario();

    const response = await admin.agent
      .get('/api/admin/privacy-operations')
      .expect(200);
    const privacyOperations = response.body.data.privacyOperations;
    const serialized = JSON.stringify(response.body);

    expect(privacyOperations.status).toBe('attention');
    expect(privacyOperations.deletionRequests).toMatchObject({
      pending: 2,
      due: 1,
      completed: 0,
    });
    expect(privacyOperations.retention).toMatchObject({
      cleanupBacklog: 3,
      expiredExportAudits: 1,
      expiredPasswordResets: 1,
      terminalNotificationOutbox: 1,
    });
    expect(privacyOperations.worker).toMatchObject({
      enabled: false,
      batchSize: 25,
      lastRun: null,
    });
    expect(serialized).not.toContain(owner.user.email);
    expect(serialized).not.toContain('private admin diagnostic message');
    expect(serialized).not.toContain('private notification preview');
    expect(serialized).not.toContain('admin-expired-reset-token');
  });
});
