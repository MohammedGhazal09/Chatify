import mongoose from 'mongoose';

const oauthHandoffSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true, index: true },
  provider: { type: String, enum: ['google', 'github', 'discord'], required: true },
  stateHash: { type: String, required: true },
  consumedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

oauthHandoffSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
oauthHandoffSchema.index({ userId: 1, consumedAt: 1, expiresAt: 1 });

const OAuthHandoff = mongoose.model('OAuthHandoffs', oauthHandoffSchema);
export default OAuthHandoff;
