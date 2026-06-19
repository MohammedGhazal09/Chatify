import mongoose from "mongoose";
import AbuseReport, {
  ABUSE_REPORT_REASONS,
  ABUSE_REPORT_STATUSES,
  ABUSE_REPORT_TARGET_TYPES,
  MODERATION_ACTIONS,
} from "../Models/abuseReportModel.mjs";
import Chats from "../Models/chatModel.mjs";
import Message from "../Models/messageModel.mjs";
import User from "../Models/userModel.mjs";
import asyncErrHandler from "../Utils/asyncErrHandler.mjs";
import { CustomError } from "../Utils/customError.mjs";
import { canUserSeeMessage } from "../Utils/messageState.mjs";

const PUBLIC_USER_SELECT = "username firstName lastName profilePic identityMark identityMarkUpdatedAt";
const REPORT_LIST_LIMIT = 50;
const TEXT_PREVIEW_LIMIT = 180;

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

const serializeObjectId = (value) => value?.toString?.() ?? value ?? null;

const serializeReport = (report) => {
  const source = report.toObject?.() ?? report;

  return {
    ...source,
    _id: serializeObjectId(source._id),
    reporter: serializeObjectId(source.reporter),
    reportedUser: serializeObjectId(source.reportedUser),
    chat: serializeObjectId(source.chat),
    message: serializeObjectId(source.message),
    reviewedBy: serializeObjectId(source.reviewedBy),
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
    })),
  };
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

const buildChatContext = (chat) => ({
  chatId: chat._id,
  isGroupChat: chat.isGroupChat === true,
  memberCount: chat.members?.length ?? 0,
});

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
  const status = req.query?.status
    ? normalizeEnumValue(req.query.status, ABUSE_REPORT_STATUSES)
    : null;

  if (req.query?.status && !status) {
    return next(new CustomError("Report status is invalid", 400));
  }

  const requestedLimit = Number(req.query?.limit);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), REPORT_LIST_LIMIT)
    : REPORT_LIST_LIMIT;
  const filter = status ? { status } : {};
  const reports = await AbuseReport.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit);

  res.status(200).json({
    status: "success",
    data: {
      reports: reports.map(serializeReport),
    },
  });
});

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
  const moderationNote = normalizeOptionalText(req.body?.note, 1000);
  const reviewedAt = new Date();

  report.status = nextStatus;
  report.moderationAction = moderationAction;
  report.moderationNote = moderationNote;
  report.reviewedBy = req.adminUserId;
  report.reviewedAt = reviewedAt;
  report.auditTrail.push({
    actor: req.adminUserId,
    status: nextStatus,
    moderationAction,
    note: moderationNote,
    createdAt: reviewedAt,
  });

  await report.save();

  res.status(200).json({
    status: "success",
    data: {
      report: serializeReport(report),
    },
  });
});
