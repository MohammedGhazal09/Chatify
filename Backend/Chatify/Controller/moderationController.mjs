import mongoose from "mongoose";
import AbuseReport, {
  ABUSE_REPORT_REASONS,
  ABUSE_REPORT_STATUSES,
  ABUSE_REPORT_TARGET_TYPES,
  MODERATION_APPEAL_STATUSES,
  MODERATION_ACTIONS,
} from "../Models/abuseReportModel.mjs";
import Attachment from "../Models/attachmentModel.mjs";
import Chats from "../Models/chatModel.mjs";
import Message from "../Models/messageModel.mjs";
import User from "../Models/userModel.mjs";
import { emitToUserSockets, getIO } from "../Config/socket.mjs";
import asyncErrHandler from "../Utils/asyncErrHandler.mjs";
import { CustomError } from "../Utils/customError.mjs";
import {
  buildUnreadMessageFilter,
  canUserSeeMessage,
  serializeMessage,
} from "../Utils/messageState.mjs";
import { logger } from "../Utils/observabilityLogger.mjs";

const PUBLIC_USER_SELECT = "username firstName lastName profilePic profileBio identityMark identityMarkUpdatedAt";
const REPORT_LIST_LIMIT = 50;
const TEXT_PREVIEW_LIMIT = 180;
const MODERATION_RESTRICTION_MS = 7 * 24 * 60 * 60 * 1000;
const HIGH_PRIORITY_REASONS = new Set(["illegal", "privacy"]);
const MEDIUM_PRIORITY_REASONS = new Set(["harassment", "impersonation"]);
const APPEALABLE_ACTIONS = new Set(["warned", "restricted", "content_removed"]);
const ACTIVE_APPEAL_STATUSES = new Set(["open", "under_review"]);
const APPEAL_REVIEW_STATUSES = ["under_review", "accepted", "rejected"];
const ENFORCEMENT_ACTIONS = new Set([
  "warned",
  "restricted",
  "restriction_lifted",
  "content_removed",
]);
const REPORT_IDENTITY_POPULATE = [
  { path: "reporter", select: PUBLIC_USER_SELECT },
  { path: "reportedUser", select: PUBLIC_USER_SELECT },
  { path: "assignedTo", select: PUBLIC_USER_SELECT },
  { path: "assignedBy", select: PUBLIC_USER_SELECT },
  { path: "assignmentHistory.assignedTo", select: PUBLIC_USER_SELECT },
  { path: "assignmentHistory.assignedBy", select: PUBLIC_USER_SELECT },
  { path: "appeals.user", select: PUBLIC_USER_SELECT },
  { path: "appeals.reviewedBy", select: PUBLIC_USER_SELECT },
];

const countUnreadForUser = (chatId, userId) => (
  Message.countDocuments(buildUnreadMessageFilter({ chatId, userId }))
);

const emitUnreadCountToUser = async (chatId, userId) => {
  const count = await countUnreadForUser(chatId, userId);
  emitToUserSockets(userId, "unread:update", {
    chatId: chatId.toString(),
    userId: userId.toString(),
    count,
  });
  return count;
};

const emitModerationContentRemoved = async (message) => {
  const chat = await Chats.findById(message.chatId).select("members").lean();

  if (!chat) {
    return;
  }

  const serializedMessage = serializeMessage(message);
  const io = getIO();

  io.in(chat._id.toString()).emit("message:deleted", {
    ...serializedMessage,
    message: serializedMessage,
    messageId: serializedMessage._id,
    deleteForEveryone: true,
    moderationAction: "content_removed",
  });

  await Promise.all((chat.members ?? []).map((memberId) => (
    emitUnreadCountToUser(chat._id, memberId)
  )));
};

const redactSensitiveText = (value = "") => String(value)
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
  .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi, "Bearer [redacted-token]")
  .replace(/\b(token|secret|password|cookie)\s*[:=]\s*\S+/gi, "$1=[redacted]")
  .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted-token]")
  .trim();

const normalizeEnumValue = (value, allowedValues, fallback = null) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return allowedValues.includes(normalized) ? normalized : fallback;
};

const normalizeOptionalText = (value, maxLength) => {
  if (typeof value !== "string") {
    return "";
  }

  return redactSensitiveText(value).slice(0, maxLength).trim();
};

const toObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }

  return new mongoose.Types.ObjectId(value);
};

const getDisplayName = (user) => {
  if (!user) {
    return "";
  }

  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.username || "Chatify user";
};

const serializeObjectId = (value) => {
  if (!value) {
    return null;
  }

  if (value._id) {
    return value._id.toString?.() ?? value._id;
  }

  return value.toString?.() ?? value;
};

const getShortIdLabel = (prefix, id) => id ? `${prefix} ${id.slice(-6)}` : prefix;

const serializeIdentity = (value, fallback = null, prefix = "User") => {
  const source = value && typeof value === "object" && !value._bsontype ? value : fallback;
  const userId = serializeObjectId(value?._id ?? value?.userId ?? fallback?._id ?? fallback?.userId ?? value);

  if (!source || typeof source !== "object") {
    return userId
      ? { userId, username: "", displayName: getShortIdLabel(prefix, userId) }
      : null;
  }

  const displayName = source.displayName ?? getDisplayName(source);
  const username = source.username ?? "";

  return {
    userId,
    username,
    displayName: displayName || username || getShortIdLabel(prefix, userId),
  };
};

const buildReportPriority = (source) => {
  if (source.status !== "open") {
    return "normal";
  }

  const createdAtMs = new Date(source.createdAt).getTime();
  const ageHours = Number.isFinite(createdAtMs)
    ? (Date.now() - createdAtMs) / (60 * 60 * 1000)
    : 0;

  if (HIGH_PRIORITY_REASONS.has(source.reason) || ageHours >= 72) {
    return "high";
  }

  if (MEDIUM_PRIORITY_REASONS.has(source.reason) || ageHours >= 24) {
    return "medium";
  }

  return "normal";
};

const serializeEnforcement = (enforcement) => enforcement
  ? {
      ...enforcement,
      targetId: serializeObjectId(enforcement.targetId),
      appliedBy: serializeObjectId(enforcement.appliedBy),
    }
  : undefined;

const serializeAssignmentHistory = (entry) => {
  const source = entry?.toObject?.() ?? entry;

  return {
    assignedTo: serializeObjectId(source?.assignedTo),
    assignedToIdentity: serializeIdentity(source?.assignedTo, null, "Assigned admin"),
    assignedBy: serializeObjectId(source?.assignedBy),
    assignedByIdentity: serializeIdentity(source?.assignedBy, null, "Assigning admin"),
    createdAt: source?.createdAt,
  };
};

const serializeAppeal = (appeal) => {
  const source = appeal?.toObject?.() ?? appeal;

  return {
    _id: serializeObjectId(source?._id),
    user: serializeObjectId(source?.user),
    userIdentity: serializeIdentity(source?.user, null, "Appeal user"),
    status: source?.status,
    reason: source?.reason ?? "",
    reviewerNote: source?.reviewerNote ?? "",
    reviewedBy: serializeObjectId(source?.reviewedBy),
    reviewedByIdentity: serializeIdentity(source?.reviewedBy, null, "Reviewer"),
    reviewedAt: source?.reviewedAt,
    createdAt: source?.createdAt,
    updatedAt: source?.updatedAt,
  };
};

const serializeReport = (report) => {
  const source = report.toObject?.() ?? report;
  const reporterId = serializeObjectId(source.reporter);
  const reportedUserId = serializeObjectId(source.reportedUser);

  return {
    ...source,
    _id: serializeObjectId(source._id),
    reporter: reporterId,
    reporterIdentity: serializeIdentity(source.reporter, null, "Reporter"),
    reportedUser: reportedUserId,
    reportedUserIdentity: serializeIdentity(
      source.reportedUser,
      source.context?.reportedUser,
      "Reported user"
    ),
    chat: serializeObjectId(source.chat),
    message: serializeObjectId(source.message),
    reviewedBy: serializeObjectId(source.reviewedBy),
    assignedTo: serializeObjectId(source.assignedTo),
    assignedToIdentity: serializeIdentity(source.assignedTo, null, "Assigned admin"),
    assignedBy: serializeObjectId(source.assignedBy),
    assignedAt: source.assignedAt,
    priority: buildReportPriority(source),
    enforcement: serializeEnforcement(source.enforcement),
    assignmentHistory: (source.assignmentHistory ?? []).map(serializeAssignmentHistory),
    appeals: (source.appeals ?? []).map(serializeAppeal),
    context: {
      ...source.context,
      reportedUser: source.context?.reportedUser
        ? {
            ...source.context.reportedUser,
            userId: serializeObjectId(source.context.reportedUser.userId),
          }
        : undefined,
      chat: source.context?.chat
        ? {
            ...source.context.chat,
            chatId: serializeObjectId(source.context.chat.chatId),
            spaceId: serializeObjectId(source.context.chat.spaceId),
            channelId: serializeObjectId(source.context.chat.channelId),
          }
        : undefined,
      message: source.context?.message
        ? {
            ...source.context.message,
            messageId: serializeObjectId(source.context.message.messageId),
            sender: serializeObjectId(source.context.message.sender),
          }
        : undefined,
    },
    auditTrail: (source.auditTrail ?? []).map((entry) => ({
      ...entry,
      actor: serializeObjectId(entry.actor),
      enforcement: serializeEnforcement(entry.enforcement),
    })),
  };
};

const serializeUserEnforcement = (report, userId) => {
  const source = report.toObject?.() ?? report;
  const appeals = source.appeals ?? [];
  const requesterAppeals = appeals
    .filter((appeal) => serializeObjectId(appeal.user) === userId.toString())
    .map(serializeAppeal);

  return {
    _id: serializeObjectId(source._id),
    targetType: source.targetType,
    reason: source.reason,
    status: source.status,
    moderationAction: source.moderationAction,
    enforcement: serializeEnforcement(source.enforcement),
    reviewedAt: source.reviewedAt,
    createdAt: source.createdAt,
    appeal: requesterAppeals.at(-1) ?? null,
    canAppeal: APPEALABLE_ACTIONS.has(source.moderationAction) &&
      !requesterAppeals.some((appeal) => ACTIVE_APPEAL_STATUSES.has(appeal.status)),
  };
};

const serializeEnforcementHistoryItem = (report) => {
  const source = report.toObject?.() ?? report;

  return {
    _id: serializeObjectId(source._id),
    targetType: source.targetType,
    reason: source.reason,
    status: source.status,
    moderationAction: source.moderationAction,
    moderationNote: source.moderationNote ?? "",
    enforcement: serializeEnforcement(source.enforcement),
    reviewedBy: serializeObjectId(source.reviewedBy),
    reviewedAt: source.reviewedAt,
    appeals: (source.appeals ?? []).map(serializeAppeal),
    createdAt: source.createdAt,
  };
};

const assertReportAppealableByUser = (report, userId) => {
  if (
    !report ||
    report.status !== "action_taken" ||
    !APPEALABLE_ACTIONS.has(report.moderationAction) ||
    !report.reportedUser?.equals?.(userId)
  ) {
    throw new CustomError("Appealable enforcement not found", 404);
  }
};

const buildCountMap = (rows, allowedKeys) => {
  const counts = Object.fromEntries(allowedKeys.map((key) => [key, 0]));

  for (const row of rows) {
    if (row?._id in counts) {
      counts[row._id] = row.count;
    }
  }

  return counts;
};

const loadUserForReport = async (userId, message = "User not found") => {
  const objectId = toObjectId(userId);

  if (!objectId) {
    throw new CustomError(message, 404);
  }

  const user = await User.findById(objectId).select(PUBLIC_USER_SELECT);

  if (!user) {
    throw new CustomError(message, 404);
  }

  return user;
};

const loadChatForReporter = async ({ chatId, reporterObjectId }) => {
  const chatObjectId = toObjectId(chatId);

  if (!chatObjectId) {
    throw new CustomError("Conversation not found", 404);
  }

  const chat = await Chats.findById(chatObjectId);

  if (!chat) {
    throw new CustomError("Conversation not found", 404);
  }

  const isMember = chat.members.some((memberId) => memberId.equals(reporterObjectId));

  if (!isMember) {
    throw new CustomError("Conversation not found", 404);
  }

  return chat;
};

const loadMessageForReporter = async ({ messageId, reporterObjectId }) => {
  const messageObjectId = toObjectId(messageId);

  if (!messageObjectId) {
    throw new CustomError("Message not found", 404);
  }

  const message = await Message.findById(messageObjectId);

  if (!message) {
    throw new CustomError("Message not found", 404);
  }

  const chat = await loadChatForReporter({
    chatId: message.chatId,
    reporterObjectId,
  });

  if (!canUserSeeMessage(message, reporterObjectId)) {
    throw new CustomError("Message not found", 404);
  }

  return { message, chat };
};

const assertReportedUserInChat = ({ chat, reporterObjectId, reportedUserObjectId }) => {
  if (reportedUserObjectId.equals(reporterObjectId)) {
    throw new CustomError("You cannot report your own account or message", 400);
  }

  const isReportedUserMember = chat.members.some((memberId) => memberId.equals(reportedUserObjectId));

  if (!isReportedUserMember) {
    throw new CustomError("User not found", 404);
  }
};

const buildChatContext = (chat) => {
  const context = {
    chatId: chat._id,
    isGroupChat: chat.isGroupChat === true,
    isSpaceChannel: chat.isSpaceChannel === true,
    memberCount: chat.members?.length ?? 0,
  };

  if (chat.isSpaceChannel === true) {
    context.spaceId = chat.space;
    context.channelId = chat._id;
    context.channelName = normalizeOptionalText(chat.channelName ?? chat.chatName, 80);
  }

  return context;
};

const buildMessageContext = (message) => ({
  messageId: message._id,
  sender: message.sender,
  messageType: message.messageType ?? "text",
  textPreview: normalizeOptionalText(message.text, TEXT_PREVIEW_LIMIT),
  attachmentCount: message.attachments?.length ?? 0,
  createdAt: message.createdAt,
});

const buildReportedUserContext = (user) => user
  ? {
      userId: user._id,
      username: user.username,
      displayName: getDisplayName(user),
    }
  : undefined;

const resolveReportTarget = async ({ targetType, body, reporterObjectId }) => {
  if (targetType === "message") {
    const { message, chat } = await loadMessageForReporter({
      messageId: body.messageId,
      reporterObjectId,
    });

    if (message.sender.equals(reporterObjectId)) {
      throw new CustomError("You cannot report your own account or message", 400);
    }

    const reportedUser = await loadUserForReport(message.sender, "User not found");

    return {
      reportedUser,
      chat,
      message,
      context: {
        reportedUser: buildReportedUserContext(reportedUser),
        chat: buildChatContext(chat),
        message: buildMessageContext(message),
      },
    };
  }

  if (targetType === "conversation") {
    const chat = await loadChatForReporter({
      chatId: body.chatId,
      reporterObjectId,
    });
    let reportedUser = null;

    if (!chat.isGroupChat && chat.members.length === 2) {
      const peerId = chat.members.find((memberId) => !memberId.equals(reporterObjectId));
      reportedUser = await loadUserForReport(peerId, "User not found");
    } else if (body.reportedUserId) {
      const reportedUserObjectId = toObjectId(body.reportedUserId);
      if (!reportedUserObjectId) {
        throw new CustomError("User not found", 404);
      }
      assertReportedUserInChat({ chat, reporterObjectId, reportedUserObjectId });
      reportedUser = await loadUserForReport(reportedUserObjectId, "User not found");
    }

    return {
      reportedUser,
      chat,
      message: null,
      context: {
        reportedUser: buildReportedUserContext(reportedUser),
        chat: buildChatContext(chat),
      },
    };
  }

  if (targetType === "user") {
    const chat = await loadChatForReporter({
      chatId: body.chatId,
      reporterObjectId,
    });
    const reportedUserObjectId = toObjectId(body.reportedUserId);

    if (!reportedUserObjectId) {
      throw new CustomError("User not found", 404);
    }

    assertReportedUserInChat({ chat, reporterObjectId, reportedUserObjectId });
    const reportedUser = await loadUserForReport(reportedUserObjectId, "User not found");

    return {
      reportedUser,
      chat,
      message: null,
      context: {
        reportedUser: buildReportedUserContext(reportedUser),
        chat: buildChatContext(chat),
      },
    };
  }

  throw new CustomError("Report target is invalid", 400);
};

export const createAbuseReport = asyncErrHandler(async (req, res, next) => {
  const reporterObjectId = toObjectId(req.userId);

  if (!reporterObjectId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  const targetType = normalizeEnumValue(req.body?.targetType, ABUSE_REPORT_TARGET_TYPES);

  if (!targetType) {
    return next(new CustomError("Report target is invalid", 400));
  }

  const reason = normalizeEnumValue(req.body?.reason, ABUSE_REPORT_REASONS, "other");
  const details = normalizeOptionalText(req.body?.details, 1000);

  try {
    const target = await resolveReportTarget({
      targetType,
      body: req.body ?? {},
      reporterObjectId,
    });

    const report = await AbuseReport.create({
      reporter: reporterObjectId,
      targetType,
      reportedUser: target.reportedUser?._id,
      chat: target.chat?._id,
      message: target.message?._id,
      reason,
      details,
      context: target.context,
    });

    res.status(201).json({
      status: "success",
      data: {
        report: serializeReport(report),
      },
    });
  } catch (error) {
    next(error);
  }
});

export const listAbuseReports = asyncErrHandler(async (req, res, next) => {
  const rawStatus = req.query?.status === "all" ? null : req.query?.status;
  const status = rawStatus
    ? normalizeEnumValue(req.query.status, ABUSE_REPORT_STATUSES)
    : null;

  if (rawStatus && !status) {
    return next(new CustomError("Report status is invalid", 400));
  }

  const requestedLimit = Number(req.query?.limit);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), REPORT_LIST_LIMIT)
    : REPORT_LIST_LIMIT;
  const filter = status ? { status } : {};
  const reports = await AbuseReport.find(filter)
    .populate(REPORT_IDENTITY_POPULATE)
    .sort({ createdAt: -1 })
    .limit(limit);

  res.status(200).json({
    status: "success",
    data: {
      reports: reports.map(serializeReport),
    },
  });
});

export const getAbuseReport = asyncErrHandler(async (req, res, next) => {
  const reportObjectId = toObjectId(req.params?.reportId);

  if (!reportObjectId) {
    return next(new CustomError("Report not found", 404));
  }

  const report = await AbuseReport.findById(reportObjectId)
    .populate(REPORT_IDENTITY_POPULATE);

  if (!report) {
    return next(new CustomError("Report not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      report: serializeReport(report),
    },
  });
});

export const listMyModerationEnforcements = asyncErrHandler(async (req, res, next) => {
  const requesterObjectId = toObjectId(req.userId);

  if (!requesterObjectId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  const reports = await AbuseReport.find({
    reportedUser: requesterObjectId,
    status: "action_taken",
    moderationAction: { $in: Array.from(APPEALABLE_ACTIONS) },
  })
    .sort({ reviewedAt: -1, createdAt: -1 })
    .limit(REPORT_LIST_LIMIT);

  res.status(200).json({
    status: "success",
    data: {
      enforcements: reports.map((report) => serializeUserEnforcement(report, requesterObjectId)),
    },
  });
});

export const submitModerationAppeal = asyncErrHandler(async (req, res, next) => {
  const requesterObjectId = toObjectId(req.userId);
  const reportObjectId = toObjectId(req.params?.reportId);

  if (!requesterObjectId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  if (!reportObjectId) {
    return next(new CustomError("Appealable enforcement not found", 404));
  }

  const report = await AbuseReport.findById(reportObjectId);

  try {
    assertReportAppealableByUser(report, requesterObjectId);
  } catch (error) {
    return next(error);
  }

  const hasActiveAppeal = (report.appeals ?? []).some((appeal) => (
    appeal.user?.equals?.(requesterObjectId) &&
    ACTIVE_APPEAL_STATUSES.has(appeal.status)
  ));

  if (hasActiveAppeal) {
    return next(new CustomError("An appeal is already open for this enforcement", 409));
  }

  const reason = normalizeOptionalText(req.body?.reason, 1000);

  if (!reason) {
    return next(new CustomError("Appeal reason is required", 400));
  }

  report.appeals.push({
    user: requesterObjectId,
    status: "open",
    reason,
  });
  await report.save();

  const appeal = report.appeals.at(-1);

  res.status(201).json({
    status: "success",
    data: {
      enforcement: serializeUserEnforcement(report, requesterObjectId),
      appeal: serializeAppeal(appeal),
    },
  });
});

export const assignAbuseReport = asyncErrHandler(async (req, res, next) => {
  const reportObjectId = toObjectId(req.params?.reportId);

  if (!reportObjectId) {
    return next(new CustomError("Report not found", 404));
  }

  const assigneeObjectId = req.body?.assignedTo
    ? toObjectId(req.body.assignedTo)
    : toObjectId(req.adminUserId);

  if (!assigneeObjectId) {
    return next(new CustomError("Assigned admin is invalid", 400));
  }

  const [report, assignee] = await Promise.all([
    AbuseReport.findById(reportObjectId),
    User.findById(assigneeObjectId).select(`${PUBLIC_USER_SELECT} +role`),
  ]);

  if (!report) {
    return next(new CustomError("Report not found", 404));
  }

  if (!assignee || assignee.role !== "admin") {
    return next(new CustomError("Assigned admin not found", 404));
  }

  const assignedAt = new Date();
  report.assignedTo = assignee._id;
  report.assignedBy = req.adminUserId;
  report.assignedAt = assignedAt;
  report.assignmentHistory.push({
    assignedTo: assignee._id,
    assignedBy: req.adminUserId,
    createdAt: assignedAt,
  });

  await report.save();
  await report.populate(REPORT_IDENTITY_POPULATE);

  res.status(200).json({
    status: "success",
    data: {
      report: serializeReport(report),
    },
  });
});

export const getModerationOpsSummary = asyncErrHandler(async (req, res) => {
  const adminObjectId = toObjectId(req.adminUserId);
  const now = new Date();

  const [
    statusRows,
    appealRows,
    unassignedOpen,
    assignedToMeOpen,
    oldestOpen,
  ] = await Promise.all([
    AbuseReport.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    AbuseReport.aggregate([
      { $unwind: "$appeals" },
      { $group: { _id: "$appeals.status", count: { $sum: 1 } } },
    ]),
    AbuseReport.countDocuments({ status: "open", assignedTo: { $exists: false } }),
    AbuseReport.countDocuments({ status: "open", assignedTo: adminObjectId }),
    AbuseReport.findOne({ status: "open" }).sort({ createdAt: 1 }).select("createdAt").lean(),
  ]);

  const oldestOpenAgeMinutes = oldestOpen?.createdAt
    ? Math.max(1, Math.floor((now.getTime() - new Date(oldestOpen.createdAt).getTime()) / 60000))
    : 0;

  res.status(200).json({
    status: "success",
    data: {
      summary: {
        reportsByStatus: buildCountMap(statusRows, ABUSE_REPORT_STATUSES),
        appealsByStatus: buildCountMap(appealRows, MODERATION_APPEAL_STATUSES),
        unassignedOpen,
        assignedToMeOpen,
        oldestOpenAgeMinutes,
      },
    },
  });
});

export const getUserEnforcementHistory = asyncErrHandler(async (req, res, next) => {
  const userObjectId = toObjectId(req.params?.userId);

  if (!userObjectId) {
    return next(new CustomError("User not found", 404));
  }

  const reports = await AbuseReport.find({
    reportedUser: userObjectId,
    status: "action_taken",
  })
    .sort({ reviewedAt: -1, createdAt: -1 })
    .limit(REPORT_LIST_LIMIT)
    .populate(REPORT_IDENTITY_POPULATE);

  res.status(200).json({
    status: "success",
    data: {
      history: reports.map(serializeEnforcementHistoryItem),
    },
  });
});

const requireEnforcementTarget = (report, targetKey, message) => {
  if (!report[targetKey]) {
    throw new CustomError(message, 400);
  }
};

const buildEnforcementSnapshot = ({
  action,
  targetType = "none",
  targetId = null,
  adminUserId,
  appliedAt,
  expiresAt = null,
  summary = "",
}) => ({
  action,
  targetType,
  targetId,
  appliedBy: adminUserId,
  appliedAt,
  expiresAt,
  summary: normalizeOptionalText(summary, 300),
});

const applyModerationEnforcement = async ({
  report,
  moderationAction,
  moderationNote,
  adminUserId,
  reviewedAt,
}) => {
  if (moderationAction === "none" || moderationAction === "account_review") {
    return buildEnforcementSnapshot({
      action: moderationAction,
      adminUserId,
      appliedAt: reviewedAt,
      summary: moderationAction === "account_review"
        ? "Account marked for follow-up review"
        : "No enforcement action applied",
    });
  }

  if (moderationAction === "warned") {
    requireEnforcementTarget(report, "reportedUser", "A reported user is required for this action");

    await User.findByIdAndUpdate(report.reportedUser, {
      $set: {
        "moderation.lastWarningAt": reviewedAt,
        "moderation.lastWarningBy": adminUserId,
        "moderation.warningReason": moderationNote,
      },
    }, { runValidators: true });

    return buildEnforcementSnapshot({
      action: moderationAction,
      targetType: "user",
      targetId: report.reportedUser,
      adminUserId,
      appliedAt: reviewedAt,
      summary: "Warning recorded for reported user",
    });
  }

  if (moderationAction === "restricted") {
    requireEnforcementTarget(report, "reportedUser", "A reported user is required for this action");

    const expiresAt = new Date(reviewedAt.getTime() + MODERATION_RESTRICTION_MS);

    await User.findByIdAndUpdate(report.reportedUser, {
      $set: {
        "moderation.messagingRestrictedUntil": expiresAt,
        "moderation.restrictedAt": reviewedAt,
        "moderation.restrictedBy": adminUserId,
        "moderation.restrictionReason": moderationNote,
      },
      $unset: {
        "moderation.restrictionLiftedAt": "",
        "moderation.restrictionLiftedBy": "",
      },
    }, { runValidators: true });

    return buildEnforcementSnapshot({
      action: moderationAction,
      targetType: "user",
      targetId: report.reportedUser,
      adminUserId,
      appliedAt: reviewedAt,
      expiresAt,
      summary: "Messaging restricted for reported user",
    });
  }

  if (moderationAction === "restriction_lifted") {
    requireEnforcementTarget(report, "reportedUser", "A reported user is required for this action");

    await User.findByIdAndUpdate(report.reportedUser, {
      $unset: {
        "moderation.messagingRestrictedUntil": "",
        "moderation.restrictedAt": "",
        "moderation.restrictedBy": "",
        "moderation.restrictionReason": "",
      },
      $set: {
        "moderation.restrictionLiftedAt": reviewedAt,
        "moderation.restrictionLiftedBy": adminUserId,
      },
    }, { runValidators: true });

    return buildEnforcementSnapshot({
      action: moderationAction,
      targetType: "user",
      targetId: report.reportedUser,
      adminUserId,
      appliedAt: reviewedAt,
      summary: "Messaging restriction lifted for reported user",
    });
  }

  if (moderationAction === "content_removed") {
    requireEnforcementTarget(report, "message", "A reported message is required for this action");

    const message = await Message.findById(report.message);

    if (!message) {
      throw new CustomError("Message not found", 404);
    }

    message.text = "";
    message.deletedForEveryone = true;
    message.deletedBy = adminUserId;
    message.deletedAt = reviewedAt;
    message.reactions = [];
    message.attachments = (message.attachments ?? []).map((attachment) => ({
      ...(attachment.toObject?.() ?? attachment),
      status: "deleted",
    }));
    await message.save();

    await Attachment.updateMany(
      { messageId: message._id },
      { $set: { status: "deleted" } }
    );

    try {
      await emitModerationContentRemoved(message);
    } catch (error) {
      logger.error("moderation.content_removed_emit_failed", {
        chatId: message.chatId?.toString(),
        messageId: message._id.toString(),
        error,
      });
    }

    return buildEnforcementSnapshot({
      action: moderationAction,
      targetType: "message",
      targetId: report.message,
      adminUserId,
      appliedAt: reviewedAt,
      summary: "Reported message content removed",
    });
  }

  throw new CustomError("Moderation action is invalid", 400);
};

export const reviewAbuseReport = asyncErrHandler(async (req, res, next) => {
  const reportObjectId = toObjectId(req.params?.reportId);

  if (!reportObjectId) {
    return next(new CustomError("Report not found", 404));
  }

  const report = await AbuseReport.findById(reportObjectId);

  if (!report) {
    return next(new CustomError("Report not found", 404));
  }

  const nextStatus = normalizeEnumValue(req.body?.status, ABUSE_REPORT_STATUSES);

  if (!nextStatus || nextStatus === "open") {
    return next(new CustomError("Review status is invalid", 400));
  }

  const moderationAction = normalizeEnumValue(
    req.body?.moderationAction,
    MODERATION_ACTIONS,
    nextStatus === "action_taken" ? "account_review" : "none"
  );

  if (nextStatus !== "action_taken" && ENFORCEMENT_ACTIONS.has(moderationAction)) {
    return next(new CustomError("Enforcement actions require action_taken status", 400));
  }

  const moderationNote = normalizeOptionalText(req.body?.note, 1000);
  const reviewedAt = new Date();
  let enforcement;

  try {
    enforcement = await applyModerationEnforcement({
      report,
      moderationAction,
      moderationNote,
      adminUserId: req.adminUserId,
      reviewedAt,
    });
  } catch (error) {
    return next(error);
  }

  report.status = nextStatus;
  report.moderationAction = moderationAction;
  report.moderationNote = moderationNote;
  report.enforcement = enforcement;
  report.reviewedBy = req.adminUserId;
  report.reviewedAt = reviewedAt;
  report.auditTrail.push({
    actor: req.adminUserId,
    status: nextStatus,
    moderationAction,
    note: moderationNote,
    enforcement,
    createdAt: reviewedAt,
  });

  await report.save();
  await report.populate(REPORT_IDENTITY_POPULATE);

  res.status(200).json({
    status: "success",
    data: {
      report: serializeReport(report),
    },
  });
});

export const reviewModerationAppeal = asyncErrHandler(async (req, res, next) => {
  const reportObjectId = toObjectId(req.params?.reportId);

  if (!reportObjectId) {
    return next(new CustomError("Report not found", 404));
  }

  const report = await AbuseReport.findById(reportObjectId);

  if (!report) {
    return next(new CustomError("Report not found", 404));
  }

  const appeal = report.appeals.id(req.params?.appealId);

  if (!appeal) {
    return next(new CustomError("Appeal not found", 404));
  }

  const nextAppealStatus = normalizeEnumValue(req.body?.status, APPEAL_REVIEW_STATUSES);

  if (!nextAppealStatus) {
    return next(new CustomError("Appeal status is invalid", 400));
  }

  const reviewerNote = normalizeOptionalText(req.body?.reviewerNote, 1000);
  const reviewedAt = new Date();

  appeal.status = nextAppealStatus;
  appeal.reviewerNote = reviewerNote;
  appeal.reviewedBy = req.adminUserId;
  appeal.reviewedAt = reviewedAt;
  report.auditTrail.push({
    actor: req.adminUserId,
    status: report.status,
    moderationAction: report.moderationAction,
    note: normalizeOptionalText(`Appeal ${nextAppealStatus}. ${reviewerNote}`, 1000),
    enforcement: report.enforcement,
    createdAt: reviewedAt,
  });

  await report.save();
  await report.populate(REPORT_IDENTITY_POPULATE);

  res.status(200).json({
    status: "success",
    data: {
      report: serializeReport(report),
      appeal: serializeAppeal(appeal),
    },
  });
});
