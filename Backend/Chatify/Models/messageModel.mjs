import mongoose from "mongoose";

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
    required: true,
    maxlength: 1000,
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
}, {
  timestamps: true,
  versionKey: false,
});

// Index for efficient queries on chat messages
messageSchema.index({ chatId: 1, createdAt: 1 });
messageSchema.index({ chatId: 1, createdAt: -1, _id: -1 });
messageSchema.index({ chatId: 1, sender: 1, status: 1 });
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
