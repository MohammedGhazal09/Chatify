import mongoose from 'mongoose';

const oauthHandoffSchema = new mongoose.Schema({
  jti: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Users',
  },
  stateHash: {
    type: String,
    required: true,
  },
  consumedAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, {
  timestamps: true,
  versionKey: false,
});

oauthHandoffSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OAuthHandoff = mongoose.model('OAuthHandoff', oauthHandoffSchema);

export default OAuthHandoff;
