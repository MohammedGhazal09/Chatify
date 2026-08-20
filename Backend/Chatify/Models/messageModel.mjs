import mongoose from "mongoose";
import { CHAT_ENCRYPTION_MODES } from "../Utils/encryptionMode.mjs";

const readBySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  readAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const reactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  emoji: {
    type: String,
    required: true,
  },
}, { _id: false });

const attachmentSummarySchema = new mongoose.Schema({
  attachmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attachments",
    required: true,
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
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
  status: {
    type: String,
    enum: ["active", "deleted"],
    default: "active",
  },
  createdAt: {
    type: Date,
  },
}, { _id: false });

const callActivitySchema = new mongoose.Schema({
  callId: {
    type: String,
    trim: true,
  },
  callerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
  },
  calleeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
  },
  mode: {
    type: String,
    enum: ["audio", "video"],
  },
  result: {
    type: String,
    enum: ["missed", "rejected", "ended", "failed", "canceled", "blocked"],
  },
  startedAt: {
    type: Date,
  },
  ringingAt: {
    type: Date,
  },
  answeredAt: {
    type: Date,
  },
  endedAt: {
    type: Date,
  },
  durationSeconds: {
    type: Number,
    min: 0,
  },
}, { _id: false });

const encryptedPayloadSchema = new mongoose.Schema({
  ciphertext: {
    type: String,
    trim: true,
  },
  iv: {
    type: String,
    trim: true,
  },
  authTag: {
    type: String,
    trim: true,
  },
  algorithm: {
    type: String,
    enum: ["AES-GCM"],
  },
  keyVersion: {
    type: Number,
    min: 1,
  },
  senderDeviceId: {
    type: String,
    trim: true,
  },
  encryptedAt: {
    type: Date,
  },
  attachmentManifest: {
    type: mongoose.Schema.Types.Mixed,
  },
}, { _id: false });

const replyToSchema = new mongoose.Schema({
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Messages",
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  messageType: {
    type: String,
    enum: ["text", "call", "encrypted"],
    default: "text",
  },
  textPreview: {
    type: String,
    maxlength: 160,
    default: "",
  },
  attachmentCount: {
    type: Number,
    min: 0,
    default: 0,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  isEncrypted: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
  },
}, { _id: false });

const mentionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  username: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: 120,
    default: "",
  },
}, { _id: false });

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Chats",
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
  },
  clientMessageId: {
    type: String,
    trim: true,
  },
  text: {
    type: String,
    required() {
      return this.messageType !== "call"
        && this.messageType !== "encrypted"
        && !this.deletedForEveryone
        && (!this.attachments || this.attachments.length === 0);
    },
    maxlength: 1000,
    default: '',
  },
  messageType: {
    type: String,
    enum: ["text", "call", "encrypted"],
    default: "text",
  },
  encryptionMode: {
    type: String,
    enum: Object.values(CHAT_ENCRYPTION_MODES),
    default: CHAT_ENCRYPTION_MODES.STANDARD,
  },
  encryptedPayload: {
    type: encryptedPayloadSchema,
  },
  encryptedPayloadFingerprint: {
    type: String,
    select: false,
  },
  replyTo: {
    type: replyToSchema,
  },
  replyFingerprint: {
    type: String,
    select: false,
  },
  mentions: {
    type: [mentionSchema],
    default: [],
  },
  mentionFingerprint: {
    type: String,
    select: false,
  },
  callActivity: {
    type: callActivitySchema,
  },
  attachments: {
    type: [attachmentSummarySchema],
    default: [],
  },
  attachmentFingerprint: {
    type: String,
    select: false,
  },
  read: {
    type: Boolean,
    default: false,
  },
  // New fields for read receipts
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent',
  },
  deliveredAt: {
    type: Date,
  },
  readAt: {
    type: Date,
  },
  readBy: [readBySchema],
  // Reactions
  reactions: [reactionSchema],
  // Edit/Delete fields
  isEdited: {
    type: Boolean,
    default: false,
  },
  editedAt: {
    type: Date,
  },
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
  }],
  deletedForEveryone: {
    type: Boolean,
    default: false,
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
  },
  deletedAt: {
    type: Date,
  },
  pinned: {
    type: Boolean,
    default: false,
  },
  pinnedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
  },
  pinnedAt: {
    type: Date,
  },
}, {
  timestamps: true,
  versionKey: false,
});

messageSchema.pre("validate", function validateEncryptedMessage(next) {
  if (this.messageType === "encrypted") {
    this.encryptionMode = CHAT_ENCRYPTION_MODES.E2EE_V1;
    this.text = "";

    if (!this.encryptedPayload?.ciphertext || !this.encryptedPayload?.iv) {
      this.invalidate("encryptedPayload", "Encrypted messages require an encrypted payload");
    }
  }

  next();
});

// Index for efficient queries on chat messages
messageSchema.index({ chatId: 1, createdAt: 1 });
messageSchema.index({ chatId: 1, createdAt: -1, _id: -1 });
messageSchema.index({ chatId: 1, sender: 1, status: 1 });
messageSchema.index({ chatId: 1, sender: 1, createdAt: -1, _id: -1 });
messageSchema.index({ chatId: 1, pinned: 1, pinnedAt: -1 });
messageSchema.index({ chatId: 1, messageType: 1, createdAt: -1 });
messageSchema.index({ chatId: 1, 'replyTo.messageId': 1, createdAt: -1 });
messageSchema.index({ chatId: 1, 'mentions.user': 1, createdAt: -1 });
messageSchema.index(
  { chatId: 1, 'callActivity.callId': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'callActivity.callId': { $exists: true, $type: "string" },
    },
  }
);
// Compound index for unread messages query optimization
messageSchema.index({ chatId: 1, sender: 1, 'readBy.user': 1 });
messageSchema.index({ chatId: 1, deletedFor: 1, deletedForEveryone: 1, createdAt: -1, _id: -1 });
messageSchema.index(
  { chatId: 1, sender: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      clientMessageId: { $exists: true, $type: "string" },
    },
  }
);

const Message = mongoose.model("Messages", messageSchema);
export default Message;
