import mongoose from 'mongoose';

const sessionFamilySchema = new mongoose.Schema({
  familyId: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
    index: true,
  },
  compromisedAt: {
    type: Date,
    default: null,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, {
  timestamps: true,
  versionKey: false,
});

sessionFamilySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionFamilySchema.index({ userId: 1, compromisedAt: 1, expiresAt: 1 });

const SessionFamily = mongoose.model('SessionFamilies', sessionFamilySchema);

export default SessionFamily;
