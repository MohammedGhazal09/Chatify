import mongoose from 'mongoose';

export const INTEGRATION_APP_TYPES = Object.freeze({
  BOT: 'bot',
  INTEGRATION: 'integration',
});

export const INTEGRATION_APP_STATUSES = Object.freeze({
  ACTIVE: 'active',
  REVOKED: 'revoked',
});

const integrationAppSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 80,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 240,
    default: '',
  },
  type: {
    type: String,
    enum: Object.values(INTEGRATION_APP_TYPES),
    default: INTEGRATION_APP_TYPES.INTEGRATION,
  },
  status: {
    type: String,
    enum: Object.values(INTEGRATION_APP_STATUSES),
    default: INTEGRATION_APP_STATUSES.ACTIVE,
    index: true,
  },
  allowedScopes: {
    type: [String],
    default: [],
  },
}, {
  timestamps: true,
  versionKey: false,
});

integrationAppSchema.index({ owner: 1, name: 1 });

const IntegrationApp = mongoose.model('IntegrationApps', integrationAppSchema);

export default IntegrationApp;
