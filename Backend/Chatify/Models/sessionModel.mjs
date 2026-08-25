import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    familyId: {
      type: String,
      required: true,
      index: true,
    },
    rememberMe: {
      type: Boolean,
      default: false,
    },
    deviceLabel: {
      type: String,
      trim: true,
      maxlength: 80,
      default: 'Unknown device',
    },
    userAgentHash: {
      type: String,
      default: null,
      select: false,
    },
    ipHash: {
      type: String,
      default: null,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    replacedByTokenHash: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });
sessionSchema.index({ userId: 1, lastUsedAt: -1 });

const Session = mongoose.model('Sessions', sessionSchema);

export default Session;
