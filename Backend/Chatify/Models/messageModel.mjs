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

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Chats",
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
  },
  text: {
    type: String,
    required: true,
    maxlength: 5000, // Limit message length
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
}, {
  timestamps: true,
  versionKey: false,
});

// Index for efficient queries on chat messages
messageSchema.index({ chatId: 1, createdAt: 1 });
messageSchema.index({ chatId: 1, sender: 1, status: 1 });
// Compound index for unread messages query optimization
messageSchema.index({ chatId: 1, sender: 1, 'readBy.user': 1 });

const Message = mongoose.model("Messages", messageSchema);
export default Message;