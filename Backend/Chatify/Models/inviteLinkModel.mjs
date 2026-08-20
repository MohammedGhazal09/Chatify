import mongoose from 'mongoose';

export const INVITE_TARGET_TYPES = Object.freeze({
  GROUP: 'group',
  SPACE: 'space',
});

const inviteLinkSchema = new mongoose.Schema({
  targetType: {
    type: String,
    enum: Object.values(INVITE_TARGET_TYPES),
    required: true,
  },
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chats',
  },
  space: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Spaces',
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    select: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  maxUses: {
    type: Number,
    min: 1,
    default: null,
  },
  useCount: {
    type: Number,
    min: 0,
    default: 0,
  },
  lastUsedAt: {
    type: Date,
    default: null,
  },
  revokedAt: {
    type: Date,
    default: null,
  },
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    default: null,
  },
}, {
  timestamps: true,
  versionKey: false,
});

inviteLinkSchema.pre('validate', function validateInviteTarget(next) {
  if (this.targetType === INVITE_TARGET_TYPES.GROUP) {
    if (!this.chat) {
      this.invalidate('chat', 'Group invite must reference a chat');
    }
    this.space = undefined;
  }

  if (this.targetType === INVITE_TARGET_TYPES.SPACE) {
    if (!this.space) {
      this.invalidate('space', 'Space invite must reference a space');
    }
    this.chat = undefined;
  }

  next();
});

inviteLinkSchema.index({ targetType: 1, chat: 1, createdAt: -1 });
inviteLinkSchema.index({ targetType: 1, space: 1, createdAt: -1 });
inviteLinkSchema.index({ expiresAt: 1 });

const InviteLink = mongoose.model('InviteLinks', inviteLinkSchema);

export default InviteLink;
