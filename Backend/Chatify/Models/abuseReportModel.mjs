import mongoose from "mongoose";

export const ABUSE_REPORT_TARGET_TYPES = Object.freeze(["user", "message", "conversation"]);
export const ABUSE_REPORT_REASONS = Object.freeze([
  "spam",
  "harassment",
  "impersonation",
  "privacy",
  "illegal",
  "other",
]);
export const ABUSE_REPORT_STATUSES = Object.freeze([
  "open",
  "reviewed",
  "dismissed",
  "action_taken",
]);
export const MODERATION_ACTIONS = Object.freeze([
  "none",
  "warned",
  "restricted",
  "content_removed",
  "account_review",
]);

const reportedUserSnapshotSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
  username: { type: String, trim: true },
  displayName: { type: String, trim: true },
}, { _id: false, versionKey: false });

const chatSnapshotSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chats" },
  isGroupChat: { type: Boolean },
  memberCount: { type: Number, min: 0 },
}, { _id: false, versionKey: false });

const messageSnapshotSchema = new mongoose.Schema({
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Messages" },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
  messageType: { type: String, trim: true },
  textPreview: { type: String, trim: true, maxlength: 220 },
  attachmentCount: { type: Number, min: 0 },
  createdAt: { type: Date },
}, { _id: false, versionKey: false });

const reportContextSchema = new mongoose.Schema({
  reportedUser: reportedUserSnapshotSchema,
  chat: chatSnapshotSchema,
  message: messageSnapshotSchema,
}, { _id: false, versionKey: false });

const auditTrailSchema = new mongoose.Schema({
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  status: {
    type: String,
    enum: ABUSE_REPORT_STATUSES,
    required: true,
  },
  moderationAction: {
    type: String,
    enum: MODERATION_ACTIONS,
    default: "none",
  },
  note: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false, versionKey: false });

const abuseReportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
    index: true,
  },
  targetType: {
    type: String,
    enum: ABUSE_REPORT_TARGET_TYPES,
    required: true,
  },
  reportedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
  },
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Chats",
  },
  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Messages",
  },
  reason: {
    type: String,
    enum: ABUSE_REPORT_REASONS,
    required: true,
  },
  details: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  status: {
    type: String,
    enum: ABUSE_REPORT_STATUSES,
    default: "open",
    index: true,
  },
  moderationAction: {
    type: String,
    enum: MODERATION_ACTIONS,
    default: "none",
  },
  moderationNote: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
  },
  reviewedAt: {
    type: Date,
  },
  context: {
    type: reportContextSchema,
    default: {},
  },
  auditTrail: {
    type: [auditTrailSchema],
    default: [],
  },
}, {
  timestamps: true,
  versionKey: false,
});

abuseReportSchema.index({ chat: 1, createdAt: -1 });
abuseReportSchema.index({ message: 1, createdAt: -1 });
abuseReportSchema.index({ reportedUser: 1, createdAt: -1 });
abuseReportSchema.index({ status: 1, createdAt: -1 });

const AbuseReport = mongoose.model("AbuseReports", abuseReportSchema);

export default AbuseReport;
