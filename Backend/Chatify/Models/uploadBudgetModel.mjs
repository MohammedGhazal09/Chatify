import mongoose from 'mongoose';

export const UPLOAD_BUDGET_PURPOSES = Object.freeze({
  ATTACHMENT: 'attachment',
  PROFILE_IMAGE: 'profile-image',
});

const uploadBudgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  purpose: {
    type: String,
    enum: Object.values(UPLOAD_BUDGET_PURPOSES),
    required: true,
  },
  periodStart: {
    type: Date,
    required: true,
  },
  bytes: {
    type: Number,
    min: 0,
    default: 0,
  },
  files: {
    type: Number,
    min: 0,
    default: 0,
  },
  requests: {
    type: Number,
    min: 0,
    default: 0,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, {
  timestamps: true,
  versionKey: false,
});

uploadBudgetSchema.index(
  { userId: 1, purpose: 1, periodStart: 1 },
  { unique: true }
);
uploadBudgetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const UploadBudget = mongoose.model('UploadBudgets', uploadBudgetSchema);

export default UploadBudget;
