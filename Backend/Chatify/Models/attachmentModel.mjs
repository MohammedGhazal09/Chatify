import mongoose from "mongoose";

export const ATTACHMENT_STORAGE_STATES = Object.freeze({
  ACTIVE: "active",
  DELETING: "deleting",
  PENDING_CLEANUP: "pending_cleanup",
  DELETED: "deleted",
});

const attachmentSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Chats",
    required: true,
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Messages",
    required: true,
  },
  uploader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  storageFileId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 140,
  },
  originalExtension: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 16,
  },
  mimeType: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  size: {
    type: Number,
    required: true,
    min: 1,
  },
  kind: {
    type: String,
    enum: ["media", "file", "voice"],
    required: true,
  },
  durationSeconds: {
    type: Number,
    min: 0,
  },
  hash: {
    type: String,
    required: true,
    select: false,
  },
  status: {
    type: String,
    enum: ["active", "deleted"],
    default: "active",
  },
  storageState: {
    type: String,
    enum: Object.values(ATTACHMENT_STORAGE_STATES),
    default: ATTACHMENT_STORAGE_STATES.ACTIVE,
    required: true,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  storageDeletedAt: {
    type: Date,
    default: null,
  },
  cleanupAttempts: {
    type: Number,
    min: 0,
    default: 0,
  },
  nextCleanupAt: {
    type: Date,
    default: null,
  },
  cleanupErrorCode: {
    type: String,
    trim: true,
    maxlength: 80,
    default: null,
    select: false,
  },
}, {
  timestamps: true,
  versionKey: false,
});

attachmentSchema.index({ chatId: 1, kind: 1, status: 1, createdAt: -1, _id: -1 });
attachmentSchema.index({ messageId: 1, status: 1 });
attachmentSchema.index({ uploader: 1, createdAt: -1 });
attachmentSchema.index({ chatId: 1, displayName: 1 });
attachmentSchema.index({ storageState: 1, nextCleanupAt: 1, updatedAt: 1 });

const Attachment = mongoose.model("Attachments", attachmentSchema);

export default Attachment;
