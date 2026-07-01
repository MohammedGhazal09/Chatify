import { describe, expect, it } from 'vitest';
import NotificationOutbox, {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_OUTBOX_STATUS,
} from '../../Models/notificationOutboxModel.mjs';
import PasswordReset from '../../Models/passwordResetModel.mjs';
import PrivacyOperationRun from '../../Models/privacyOperationRunModel.mjs';
import PrivacyRequest, {
  PRIVACY_REQUEST_ACTIONS,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
} from '../../Models/privacyRequestModel.mjs';
import Session from '../../Models/sessionModel.mjs';
import User from '../../Models/userModel.mjs';
import { processPrivacyOperations } from '../../Services/privacyOperationsService.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { createMessage } from '../fixtures/messages.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const now = new Date('2026-07-01T09:00:00.000Z');
const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const daysFromNow = (days) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

const createDeletionRequest = (user, overrides = {}) => PrivacyRequest.create({
  user: user._id,
  type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
  status: PRIVACY_REQUEST_STATUSES.PENDING,
  requestedAt: daysAgo(20),
  scheduledFor: daysAgo(1),
  retentionSummary: {
    authentication: 'Pending worker processing',
  },
  events: [{
    action: PRIVACY_REQUEST_ACTIONS.DELETION_REQUESTED,
    actor: user._id,
    metadata: {},
  }],
  ...overrides,
});

const createOutboxItem = async ({ sender, recipient, updatedAt = daysAgo(1), status = NOTIFICATION_OUTBOX_STATUS.SENT }) => {
  const chat = await createDirectChat([sender, recipient]);
  const message = await createMessage({
    chat,
    sender,
    text: 'private message body must not enter privacy operation evidence',
  });
  const outbox = await NotificationOutbox.create({
    dedupeKey: `privacy-operation-${message._id}-${status}`,
    recipient: recipient._id,
    sender: sender._id,
    chatId: chat._id,
    messageId: message._id,
    channel: NOTIFICATION_CHANNELS.EMAIL,
    status,
    attempts: 1,
    sentAt: updatedAt,
    payload: {
      templateKey: 'message',
      title: 'Private title',
      body: 'private notification preview must not persist in evidence',
    },
  });

  await NotificationOutbox.updateOne(
    { _id: outbox._id },
    { $set: { createdAt: updatedAt, updatedAt } },
    { timestamps: false }
  );

  return outbox;
};

describe('privacy operations worker', () => {
  it('processes due deletion requests with account anonymization and metadata-only evidence', async () => {
    const owner = await signupWithAgent({
      firstName: 'Privacy',
      lastName: 'Delete',
      username: 'privacy.delete',
      email: 'privacy-delete@example.test',
    });
    const peer = await signupWithAgent({
      firstName: 'Privacy',
      lastName: 'Peer',
      username: 'privacy.peer',
      email: 'privacy-peer@example.test',
    });
    const request = await createDeletionRequest(owner.user);

    await PasswordReset.create({
      userId: owner.user._id,
      email: owner.user.email,
      tokenHash: 'hashed-reset-token',
      expiresAt: daysFromNow(1),
    });
    await createOutboxItem({ sender: owner.user, recipient: peer.user });

    expect(await Session.countDocuments({ userId: owner.user._id })).toBeGreaterThan(0);

    const result = await processPrivacyOperations({ now });
    const storedUser = await User.findById(owner.user._id)
      .select('+password +googleId +discordId +githubId +role +notificationPreferences.pushSubscriptions')
      .lean();
    const completedRequest = await PrivacyRequest.findById(request._id).lean();
    const operationRun = await PrivacyOperationRun.findOne({}).lean();
    const evidenceText = JSON.stringify({ result, completedRequest, operationRun, storedUser });

    expect(result.status).toBe('completed');
    expect(result.counts).toMatchObject({
      deletionRequestsProcessed: 1,
      accountsAnonymized: 1,
      sessionsRemoved: 1,
      passwordResetsDeleted: 1,
      notificationOutboxDeleted: 1,
      errors: 0,
    });
    expect(storedUser).toMatchObject({
      firstName: 'Deleted',
      lastName: 'User',
      email: `deleted-${owner.user._id}@chatify.invalid`,
      username: `deleted_${owner.user._id.toString().slice(-16)}`,
      authProvider: 'local',
      isVerified: false,
      role: 'user',
      showOnlineStatus: false,
      showLastSeen: false,
      showProfileStatus: false,
    });
    expect(storedUser.password).toBeUndefined();
    expect(storedUser.googleId).toBeUndefined();
    expect(storedUser.notificationPreferences.pushSubscriptions).toEqual([]);
    expect(await Session.countDocuments({ userId: owner.user._id })).toBe(0);
    expect(await PasswordReset.countDocuments({ userId: owner.user._id })).toBe(0);
    expect(await NotificationOutbox.countDocuments({
      $or: [
        { sender: owner.user._id },
        { recipient: owner.user._id },
      ],
    })).toBe(0);
    expect(completedRequest.status).toBe(PRIVACY_REQUEST_STATUSES.COMPLETED);
    expect(completedRequest.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: PRIVACY_REQUEST_ACTIONS.DELETION_PROCESSED,
      }),
    ]));
    expect(operationRun.counts.deletionRequestsProcessed).toBe(1);
    expect(evidenceText).not.toContain('privacy-delete@example.test');
    expect(evidenceText).not.toContain('private notification preview');
    expect(evidenceText).not.toContain('hashed-reset-token');
  });

  it('cleans expired privacy artifacts without processing future deletion requests', async () => {
    const owner = await signupWithAgent({
      firstName: 'Privacy',
      lastName: 'Retention',
      username: 'privacy.retention',
      email: 'privacy-retention@example.test',
    });
    const peer = await signupWithAgent({
      firstName: 'Privacy',
      lastName: 'Retention Peer',
      username: 'privacy.retention.peer',
      email: 'privacy-retention-peer@example.test',
    });

    await createDeletionRequest(owner.user, {
      scheduledFor: daysFromNow(3),
    });
    await PrivacyRequest.create({
      user: owner.user._id,
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_EXPORT,
      status: PRIVACY_REQUEST_STATUSES.COMPLETED,
      requestedAt: daysAgo(20),
      completedAt: daysAgo(20),
      expiresAt: daysAgo(1),
      recordCounts: { messages: 1 },
      events: [{
        action: PRIVACY_REQUEST_ACTIONS.EXPORT_CREATED,
        actor: owner.user._id,
        metadata: { recordCounts: { messages: 1 } },
      }],
    });
    await PasswordReset.create({
      userId: owner.user._id,
      email: owner.user.email,
      tokenHash: 'expired-reset-token',
      expiresAt: daysAgo(1),
    });
    await Session.create({
      userId: owner.user._id,
      refreshTokenHash: 'expired-refresh-token-hash',
      familyId: 'expired-family',
      expiresAt: daysAgo(1),
    });
    await createOutboxItem({
      sender: peer.user,
      recipient: owner.user,
      updatedAt: daysAgo(45),
      status: NOTIFICATION_OUTBOX_STATUS.FAILED,
    });

    const result = await processPrivacyOperations({ now });
    const pendingDeletion = await PrivacyRequest.findOne({
      user: owner.user._id,
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
    }).lean();

    expect(result.counts).toMatchObject({
      deletionRequestsProcessed: 0,
      accountsAnonymized: 0,
      expiredExportAuditsDeleted: 1,
      expiredPasswordResetsDeleted: 1,
      expiredSessionsDeleted: 1,
      terminalNotificationOutboxDeleted: 1,
      errors: 0,
    });
    expect(pendingDeletion.status).toBe(PRIVACY_REQUEST_STATUSES.PENDING);
    expect(await PrivacyRequest.countDocuments({ type: PRIVACY_REQUEST_TYPES.ACCOUNT_EXPORT })).toBe(0);
    expect(await PasswordReset.countDocuments({ tokenHash: 'expired-reset-token' })).toBe(0);
    expect(await Session.countDocuments({ refreshTokenHash: 'expired-refresh-token-hash' })).toBe(0);
    expect(await NotificationOutbox.countDocuments({ status: NOTIFICATION_OUTBOX_STATUS.FAILED })).toBe(0);
  });
});
