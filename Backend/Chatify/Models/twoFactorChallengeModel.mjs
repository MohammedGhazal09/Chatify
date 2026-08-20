import mongoose from 'mongoose';

const twoFactorChallengeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
    index: true,
  },
  challengeTokenHash: {
    type: String,
    required: true,
    unique: true,
  },
  rememberMe: {
    type: Boolean,
    default: false,
  },
  attemptCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  consumedAt: {
    type: Date,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, {
  timestamps: true,
  versionKey: false,
});

twoFactorChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
twoFactorChallengeSchema.index({ userId: 1, consumedAt: 1, expiresAt: 1 });

const TwoFactorChallenge = mongoose.model('TwoFactorChallenges', twoFactorChallengeSchema);

export default TwoFactorChallenge;
