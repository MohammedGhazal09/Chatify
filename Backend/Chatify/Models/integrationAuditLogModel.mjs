import mongoose from 'mongoose';

export const INTEGRATION_AUDIT_ACTIONS = Object.freeze({
  APP_CREATED: 'app_created',
  INSTALLED: 'installed',
  TOKEN_ROTATED: 'token_rotated',
  REVOKED: 'revoked',
  RUNTIME_MANIFEST_READ: 'runtime_manifest_read',
  RUNTIME_DENIED: 'runtime_denied',
});

export const INTEGRATION_AUDIT_STATUSES = Object.freeze({
  SUCCESS: 'success',
  DENIED: 'denied',
});

const integrationAuditLogSchema = new mongoose.Schema({
  app: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IntegrationApps',
    index: true,
  },
  installation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IntegrationInstallations',
    index: true,
  },
  actorUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
  },
  action: {
    type: String,
    enum: Object.values(INTEGRATION_AUDIT_ACTIONS),
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: Object.values(INTEGRATION_AUDIT_STATUSES),
    default: INTEGRATION_AUDIT_STATUSES.SUCCESS,
    index: true,
  },
  targetType: {
    type: String,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  scopes: {
    type: [String],
    default: [],
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
  versionKey: false,
});

integrationAuditLogSchema.index({ createdAt: -1, _id: -1 });

const IntegrationAuditLog = mongoose.model('IntegrationAuditLogs', integrationAuditLogSchema);

export default IntegrationAuditLog;
