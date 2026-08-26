import mongoose from 'mongoose';

const twoFactorUsageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
    unique: true,
    index: true,
  },
  lastAcceptedCounter: {
    type: Number,
    required: true,
    min: 0,
  },
}, {
  timestamps: true,
  versionKey: false,
});

const TwoFactorUsage = mongoose.model('TwoFactorUsage', twoFactorUsageSchema);
export default TwoFactorUsage;
