import mongoose from 'mongoose';

export const INTEGRATION_INSTALLATION_TARGETS = Object.freeze({
  SPACE: 'space',
  CHAT: 'chat',
});

export const INTEGRATION_INSTALLATION_STATUSES = Object.freeze({
  ACTIVE: 'active',
  REVOKED: 'revoked',
});

const integrationInstallationSchema = new mongoose.Schema({
  app: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IntegrationApps',
    required: true,
    index: true,
  },
  installedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  targetType: {
    type: String,
    enum: Object.values(INTEGRATION_INSTALLATION_TARGETS),
    required: true,
    index: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  scopes: {
    type: [String],
    default: [],
  },
  status: {
    type: String,
    enum: Object.values(INTEGRATION_INSTALLATION_STATUSES),
    default: INTEGRATION_INSTALLATION_STATUSES.ACTIVE,
    index: true,
  },
  tokenHash: {
    type: String,
    required: true,
    select: false,
  },
  tokenRotatedAt: {
    type: Date,
    default: Date.now,
  },
  revokedAt: {
    type: Date,
  },
}, {
  timestamps: true,
  versionKey: false,
});

integrationInstallationSchema.index(
  { app: 1, targetType: 1, targetId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: INTEGRATION_INSTALLATION_STATUSES.ACTIVE },
  }
);
integrationInstallationSchema.index({ tokenHash: 1 }, { unique: true });

const IntegrationInstallation = mongoose.model('IntegrationInstallations', integrationInstallationSchema);

export default IntegrationInstallation;
