import mongoose from 'mongoose';
import AbuseReport from '../Models/abuseReportModel.mjs';
import Chats from '../Models/chatModel.mjs';
import Message from '../Models/messageModel.mjs';
import PrivacyRequest, {
  PRIVACY_REQUEST_ACTIONS,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
} from '../Models/privacyRequestModel.mjs';
import Session from '../Models/sessionModel.mjs';
import Spaces from '../Models/spaceModel.mjs';
import User from '../Models/userModel.mjs';
import asyncErrHandler from '../Utils/asyncErrHandler.mjs';
import { CustomError } from '../Utils/customError.mjs';
import { CHAT_ENCRYPTION_MODES } from '../Utils/encryptionMode.mjs';

const EXPORT_VERSION = '2026-06-21';
const DELETION_DELAY_DAYS = 14;
const PUBLIC_MEMBER_SELECT = 'username firstName lastName profilePic profileBio profileStatus showProfileStatus identityMark identityMarkUpdatedAt';

const toIdString = (value) => value?._id?.toString?.() ?? value?.toString?.() ?? '';

const serializeDate = (value) => value?.toISOString?.() ?? value ?? null;

const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const buildRetentionSummary = (scheduledFor = null) => ({
  scheduledFor: serializeDate(scheduledFor),
  reversibleUntil: serializeDate(scheduledFor),
  accountProfile: 'Scheduled for anonymization after the waiting period.',
  authentication: 'Login sessions and credentials are revoked by the deletion worker after the waiting period.',
  conversations: 'Messages remain as conversation tombstones or sender records where needed for other participants.',
  media: 'Owned media is removed or detached when no longer required by retained conversation records.',
  moderation: 'Abuse, security, and audit records may be retained in redacted form for safety and fraud prevention.',
  backups: 'Backup retention follows the deployment provider backup lifecycle and is not purged by this local request.',
});

const serializePublicUser = (user) => {
  const userObject = user?.toObject?.() ?? user;
  const userId = toIdString(userObject);

  if (!userId) {
    return null;
  }

  return {
    _id: userId,
    username: userObject.username ?? '',
    firstName: userObject.firstName ?? '',
    lastName: userObject.lastName ?? '',
    profilePic: userObject.profilePic ?? '',
    profileBio: userObject.profileBio ?? '',
    profileStatus: userObject.showProfileStatus === false ? '' : userObject.profileStatus ?? '',
    identityMark: userObject.identityMark ?? null,
    identityMarkUpdatedAt: serializeDate(userObject.identityMarkUpdatedAt),
  };
};

const serializeOwnAccount = (user) => ({
  _id: toIdString(user),
  email: user.email,
  username: user.username ?? '',
  firstName: user.firstName ?? '',
  lastName: user.lastName ?? '',
  profilePic: user.profilePic ?? '',
  profileBio: user.profileBio ?? '',
  profileStatus: user.profileStatus ?? '',
  showOnlineStatus: user.showOnlineStatus !== false,
  showLastSeen: user.showLastSeen !== false,
  showProfileStatus: user.showProfileStatus !== false,
  authProvider: user.authProvider,
  isVerified: user.isVerified === true,
  notificationPreferences: {
    pushEnabled: user.notificationPreferences?.pushEnabled === true,
    emailNotificationsEnabled: user.notificationPreferences?.emailNotificationsEnabled === true,
    messagePreviewMode: user.notificationPreferences?.messagePreviewMode ?? 'none',
    mutedChatIds: (user.notificationPreferences?.mutedChatIds ?? []).map(toIdString),
    emailUnsubscribed: Boolean(user.notificationPreferences?.emailUnsubscribedAt),
    pushSubscriptionCount: user.notificationPreferences?.pushSubscriptions?.length ?? 0,
  },
  identityMark: user.identityMark ?? null,
  identityMarkUpdatedAt: serializeDate(user.identityMarkUpdatedAt),
  createdAt: serializeDate(user.createdAt),
  updatedAt: serializeDate(user.updatedAt),
});

const serializeModerationSummary = (user) => ({
  lastWarningAt: serializeDate(user.moderation?.lastWarningAt),
  messagingRestrictedUntil: serializeDate(user.moderation?.messagingRestrictedUntil),
  restrictedAt: serializeDate(user.moderation?.restrictedAt),
  restrictionLiftedAt: serializeDate(user.moderation?.restrictionLiftedAt),
  hasWarning: Boolean(user.moderation?.lastWarningAt),
  hasActiveRestriction: Boolean(
    user.moderation?.messagingRestrictedUntil &&
    new Date(user.moderation.messagingRestrictedUntil).getTime() > Date.now()
  ),
});

const serializeChat = (chat) => ({
  _id: toIdString(chat),
  chatName: chat.chatName ?? '',
  isGroupChat: chat.isGroupChat === true,
  isSpaceChannel: chat.isSpaceChannel === true,
  spaceId: toIdString(chat.space),
  channelName: chat.channelName ?? '',
  channelDescription: chat.channelDescription ?? '',
  encryptionMode: chat.encryptionMode,
  members: (chat.members ?? []).map(serializePublicUser).filter(Boolean),
  latestMessage: toIdString(chat.latestMessage),
  createdAt: serializeDate(chat.createdAt),
  updatedAt: serializeDate(chat.updatedAt),
});

const serializeSpace = (space) => ({
  _id: toIdString(space),
  name: space.name,
  description: space.description ?? '',
  owner: toIdString(space.owner),
  defaultChannel: toIdString(space.defaultChannel),
  members: (space.members ?? []).map((member) => ({
    userId: toIdString(member.user),
    role: member.role,
    joinedAt: serializeDate(member.joinedAt),
    user: serializePublicUser(member.user),
  })),
  createdAt: serializeDate(space.createdAt),
  updatedAt: serializeDate(space.updatedAt),
});

const serializeAttachment = (attachment) => ({
  attachmentId: toIdString(attachment.attachmentId),
  displayName: attachment.displayName,
  mimeType: attachment.mimeType,
  size: attachment.size,
  kind: attachment.kind,
  durationSeconds: attachment.durationSeconds ?? null,
  status: attachment.status ?? 'active',
  createdAt: serializeDate(attachment.createdAt),
  downloadUrl: attachment.attachmentId
    ? `/api/message/attachments/${toIdString(attachment.attachmentId)}/download`
    : null,
});

const getExportableAttachments = (message) => {
  if (message.deletedForEveryone === true) {
    return [];
  }

  return (message.attachments ?? []).filter((attachment) => attachment.status !== 'deleted');
};

const serializeEncryptedPayloadMetadata = (payload) => {
  if (!payload) {
    return null;
  }

  return {
    ciphertext: payload.ciphertext,
    iv: payload.iv,
    authTag: payload.authTag ?? null,
    algorithm: payload.algorithm,
    keyVersion: payload.keyVersion,
    senderDeviceId: payload.senderDeviceId,
    encryptedAt: serializeDate(payload.encryptedAt),
    attachmentManifest: payload.attachmentManifest ?? null,
  };
};

const serializeMessage = (message) => {
  const isEncrypted = message.encryptionMode === CHAT_ENCRYPTION_MODES.E2EE_V1 || message.messageType === 'encrypted';
  const deletedForEveryone = message.deletedForEveryone === true;

  return {
    _id: toIdString(message),
    chatId: toIdString(message.chatId),
    sender: toIdString(message.sender),
    clientMessageId: message.clientMessageId ?? null,
    messageType: message.messageType,
    encryptionMode: message.encryptionMode,
    text: deletedForEveryone || isEncrypted ? '' : message.text ?? '',
    encryptedPayload: isEncrypted ? serializeEncryptedPayloadMetadata(message.encryptedPayload) : null,
    exportLimitation: isEncrypted
      ? 'Encrypted message plaintext is device-local and is not recoverable by the server export.'
      : null,
    attachments: getExportableAttachments(message).map(serializeAttachment),
    status: message.status,
    readBy: (message.readBy ?? []).map((entry) => ({
      user: toIdString(entry.user),
      readAt: serializeDate(entry.readAt),
    })),
    reactions: (message.reactions ?? []).map((reaction) => ({
      user: toIdString(reaction.user),
      emoji: reaction.emoji,
    })),
    isEdited: message.isEdited === true,
    editedAt: serializeDate(message.editedAt),
    deletedForEveryone,
    deletedAt: serializeDate(message.deletedAt),
    pinned: message.pinned === true,
    pinnedAt: serializeDate(message.pinnedAt),
    createdAt: serializeDate(message.createdAt),
    updatedAt: serializeDate(message.updatedAt),
  };
};

const serializeFiledReport = (report) => ({
  _id: toIdString(report),
  targetType: report.targetType,
  reason: report.reason,
  status: report.status,
  moderationAction: report.moderationAction,
  context: report.context ?? {},
  createdAt: serializeDate(report.createdAt),
  updatedAt: serializeDate(report.updatedAt),
});

const serializeSession = (session) => ({
  _id: toIdString(session),
  deviceLabel: session.deviceLabel,
  rememberMe: session.rememberMe === true,
  expiresAt: serializeDate(session.expiresAt),
  lastUsedAt: serializeDate(session.lastUsedAt),
  revokedAt: serializeDate(session.revokedAt),
  createdAt: serializeDate(session.createdAt),
});

const buildRecordCounts = ({ chats, spaces, messages, reports, sessions }) => ({
  chats: chats.length,
  spaces: spaces.length,
  messages: messages.length,
  reports: reports.length,
  sessions: sessions.length,
  attachments: messages.reduce((count, message) => count + getExportableAttachments(message).length, 0),
});

const serializePrivacyRequest = (request) => {
  if (!request) {
    return null;
  }

  return {
    _id: toIdString(request),
    type: request.type,
    status: request.status,
    requestedAt: serializeDate(request.requestedAt),
    completedAt: serializeDate(request.completedAt),
    scheduledFor: serializeDate(request.scheduledFor),
    canceledAt: serializeDate(request.canceledAt),
    expiresAt: serializeDate(request.expiresAt),
    recordCounts: request.recordCounts ?? {},
    retentionSummary: request.retentionSummary ?? {},
  };
};

const getPendingDeletionRequest = (userId) => PrivacyRequest.findOne({
  user: userId,
  type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
  status: PRIVACY_REQUEST_STATUSES.PENDING,
});

const isDuplicateKeyError = (error) => error?.code === 11000;

const loadExportData = async (userId) => {
  const user = await User.findById(userId)
    .select('+moderation +notificationPreferences.pushSubscriptions');

  if (!user) {
    throw new CustomError('User not found', 404);
  }

  const chats = await Chats.find({ members: userId })
    .populate('members', PUBLIC_MEMBER_SELECT)
    .sort({ updatedAt: -1, _id: -1 });
  const chatIds = chats.map((chat) => chat._id);
  const spaces = await Spaces.find({ 'members.user': userId })
    .populate('members.user', PUBLIC_MEMBER_SELECT)
    .sort({ updatedAt: -1, _id: -1 });
  const messages = await Message.find({
    chatId: { $in: chatIds },
    deletedFor: { $ne: new mongoose.Types.ObjectId(userId) },
  }).sort({ createdAt: 1, _id: 1 });
  const reports = await AbuseReport.find({ reporter: userId })
    .sort({ createdAt: -1, _id: -1 });
  const sessions = await Session.find({ userId })
    .sort({ lastUsedAt: -1, _id: -1 });

  return { user, chats, spaces, messages, reports, sessions };
};

export const getPrivacySummary = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError('Not authorized to access this route', 401));
  }

  const pendingDeletionRequest = await getPendingDeletionRequest(requesterId);

  res.status(200).json({
    status: 'success',
    data: {
      exportVersion: EXPORT_VERSION,
      deletionRequest: serializePrivacyRequest(pendingDeletionRequest),
      retentionSummary: buildRetentionSummary(pendingDeletionRequest?.scheduledFor ?? null),
    },
  });
});

export const exportAccountData = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError('Not authorized to access this route', 401));
  }

  const exportData = await loadExportData(requesterId);
  const recordCounts = buildRecordCounts(exportData);
  const now = new Date();
  const expiresAt = addDays(now, 7);
  const audit = await PrivacyRequest.create({
    user: requesterId,
    type: PRIVACY_REQUEST_TYPES.ACCOUNT_EXPORT,
    status: PRIVACY_REQUEST_STATUSES.COMPLETED,
    requestedAt: now,
    completedAt: now,
    expiresAt,
    recordCounts,
    retentionSummary: {
      exportPayload: 'Generated for this response only; raw export payload is not stored server-side.',
      expiresAt: serializeDate(expiresAt),
    },
    events: [{
      action: PRIVACY_REQUEST_ACTIONS.EXPORT_CREATED,
      actor: requesterId,
      metadata: { recordCounts },
    }],
  });

  res.status(200).json({
    status: 'success',
    data: {
      export: {
        exportVersion: EXPORT_VERSION,
        generatedAt: serializeDate(now),
        account: serializeOwnAccount(exportData.user),
        moderationSummary: serializeModerationSummary(exportData.user),
        sessions: exportData.sessions.map(serializeSession),
        chats: exportData.chats.map(serializeChat),
        spaces: exportData.spaces.map(serializeSpace),
        messages: exportData.messages.map(serializeMessage),
        reportsFiledByUser: exportData.reports.map(serializeFiledReport),
        retentionSummary: buildRetentionSummary(),
        limitations: [
          'Encrypted message plaintext is device-local and is not recoverable by the server export.',
          'Attachment file bytes are available through protected download URLs, not embedded in this JSON export.',
          'Admin-only moderation notes and reviewer internals are not included.',
        ],
      },
      audit: serializePrivacyRequest(audit),
    },
  });
});

export const requestAccountDeletion = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError('Not authorized to access this route', 401));
  }

  const now = new Date();
  const existing = await getPendingDeletionRequest(requesterId);

  if (existing) {
    return res.status(200).json({
      status: 'success',
      data: {
        deletionRequest: serializePrivacyRequest(existing),
        retentionSummary: existing.retentionSummary,
      },
    });
  }

  const scheduledFor = addDays(now, DELETION_DELAY_DAYS);
  const retentionSummary = buildRetentionSummary(scheduledFor);
  let deletionRequest;

  try {
    deletionRequest = await PrivacyRequest.create({
      user: requesterId,
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
      status: PRIVACY_REQUEST_STATUSES.PENDING,
      requestedAt: now,
      scheduledFor,
      retentionSummary,
      events: [{
        action: PRIVACY_REQUEST_ACTIONS.DELETION_REQUESTED,
        actor: requesterId,
        metadata: { scheduledFor: serializeDate(scheduledFor) },
      }],
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    deletionRequest = await getPendingDeletionRequest(requesterId);

    if (!deletionRequest) {
      throw error;
    }

    return res.status(200).json({
      status: 'success',
      data: {
        deletionRequest: serializePrivacyRequest(deletionRequest),
        retentionSummary: deletionRequest.retentionSummary,
      },
    });
  }

  res.status(201).json({
    status: 'success',
    data: {
      deletionRequest: serializePrivacyRequest(deletionRequest),
      retentionSummary,
    },
  });
});

export const cancelAccountDeletion = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError('Not authorized to access this route', 401));
  }

  const deletionRequest = await getPendingDeletionRequest(requesterId);

  if (!deletionRequest) {
    return next(new CustomError('No pending deletion request found', 404));
  }

  deletionRequest.status = PRIVACY_REQUEST_STATUSES.CANCELED;
  deletionRequest.canceledAt = new Date();
  deletionRequest.events.push({
    action: PRIVACY_REQUEST_ACTIONS.DELETION_CANCELED,
    actor: requesterId,
    metadata: {},
  });
  await deletionRequest.save();

  res.status(200).json({
    status: 'success',
    data: {
      deletionRequest: serializePrivacyRequest(deletionRequest),
      retentionSummary: buildRetentionSummary(),
    },
  });
});
