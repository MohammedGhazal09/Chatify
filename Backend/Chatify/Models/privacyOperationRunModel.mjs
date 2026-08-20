import mongoose from 'mongoose';

export const PRIVACY_OPERATION_RUN_STATUSES = Object.freeze({
  COMPLETED: 'completed',
  FAILED: 'failed',
});

export const PRIVACY_OPERATION_RUN_TRIGGERS = Object.freeze({
  WORKER: 'worker',
  MANUAL: 'manual',
});

const privacyOperationRunSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: Object.values(PRIVACY_OPERATION_RUN_STATUSES),
    required: true,
    index: true,
  },
  trigger: {
    type: String,
    enum: Object.values(PRIVACY_OPERATION_RUN_TRIGGERS),
    default: PRIVACY_OPERATION_RUN_TRIGGERS.WORKER,
    index: true,
  },
  dryRun: {
    type: Boolean,
    default: false,
  },
  startedAt: {
    type: Date,
    required: true,
    index: true,
  },
  completedAt: {
    type: Date,
    required: true,
    index: true,
  },
  counts: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
  versionKey: false,
});

privacyOperationRunSchema.index({ completedAt: -1, _id: -1 });

const PrivacyOperationRun = mongoose.model('PrivacyOperationRuns', privacyOperationRunSchema);

export default PrivacyOperationRun;
