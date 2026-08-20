import mongoose from 'mongoose';

const conversationOrganizationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chats',
      required: true,
    },
    archived: {
      type: Boolean,
      default: false,
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    favorite: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

conversationOrganizationSchema.index({ user: 1, chat: 1 }, { unique: true });
conversationOrganizationSchema.index({ user: 1, pinned: 1, updatedAt: -1 });
conversationOrganizationSchema.index({ user: 1, archived: 1, updatedAt: -1 });
conversationOrganizationSchema.index({ user: 1, favorite: 1, updatedAt: -1 });

const ConversationOrganization = mongoose.model(
  'ConversationOrganizations',
  conversationOrganizationSchema
);

export default ConversationOrganization;
