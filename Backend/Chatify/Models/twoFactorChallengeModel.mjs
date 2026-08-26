import mongoose from 'mongoose';

const twoFactorChallengeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true, index: true },
  challengeTokenHash: { type: String, required: true, unique: true },
  rememberMe: { type: Boolean, default: false },
  userAgentHash: { type: String, default: null, select: false },
  ipHash: { type: String, default: null, select: false },
  attemptCount: { type: Number, default: 0, min: 0 },
  verificationClaimTokenHash: { type: String, default: null, select: false },
  verificationClaimExpiresAt: { type: Date, default: null },
  consumedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

twoFactorChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
twoFactorChallengeSchema.index({ userId: 1, consumedAt: 1, expiresAt: 1 });
twoFactorChallengeSchema.index({ verificationClaimExpiresAt: 1, consumedAt: 1 });

const TwoFactorChallenge = mongoose.model('TwoFactorChallenges', twoFactorChallengeSchema);
export default TwoFactorChallenge;
