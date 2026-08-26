import mongoose from 'mongoose';

export const PRIVACY_REQUEST_TYPES = Object.freeze({
  ACCOUNT_EXPORT: 'account_export',
  ACCOUNT_DELETION: 'account_deletion',
});

export const PRIVACY_REQUEST_STATUSES = Object.freeze({
  PENDING: 'pending',
  CLEANUP_PENDING: 'cleanup_pending',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
});

export const PRIVACY_REQUEST_ACTIONS = Object.freeze({
  EXPORT_CREATED: 'export_created',
  DELETION_REQUESTED: 'deletion_requested',
  DELETION_CANCELED: 'deletion_canceled',
  DELETION_CORE_PROCESSED: 'deletion_core_processed',
  DELETION_CLEANUP_RETRY: 'deletion_cleanup_retry',
  DELETION_PROCESSED: 'deletion_processed',
});

const privacyRequestEventSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: Object.values(PRIVACY_REQUEST_ACTIONS),
    required: true,
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  _id: false,
  versionKey: false,
});

const deletionCleanupSchema = new mongoose.Schema({
  profileImageStorageId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    select: false,
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0,
  },
  nextAttemptAt: {
    type: Date,
    default: null,
  },
  lastAttemptAt: {
    type: Date,
    default: null,
  },
  lastErrorCode: {
    type: String,
    trim: true,
    maxlength: 120,
    default: null,
  },
}, {
  _id: false,
  versionKey: false,
});

const privacyRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: Object.values(PRIVACY_REQUEST_TYPES),
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: Object.values(PRIVACY_REQUEST_STATUSES),
    required: true,
    index: true,
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
  },
  scheduledFor: {
    type: Date,
  },
  canceledAt: {
    type: Date,
  },
  expiresAt: {
    type: Date,
  },
  cleanup: {
    type: deletionCleanupSchema,
    default: undefined,
  },
  recordCounts: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  retentionSummary: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  events: {
    type: [privacyRequestEventSchema],
    default: [],
  },
}, {
  timestamps: true,
  versionKey: false,
});

privacyRequestSchema.index(
  { user: 1, type: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
      status: {
        $in: [
          PRIVACY_REQUEST_STATUSES.PENDING,
          PRIVACY_REQUEST_STATUSES.CLEANUP_PENDING,
        ],
      },
    },
  }
);
privacyRequestSchema.index({
  type: 1,
  status: 1,
  'cleanup.nextAttemptAt': 1,
  scheduledFor: 1,
});

const PrivacyRequest = mongoose.model('PrivacyRequests', privacyRequestSchema);

export default PrivacyRequest;
