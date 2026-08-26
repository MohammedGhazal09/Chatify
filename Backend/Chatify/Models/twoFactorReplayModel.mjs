import mongoose from 'mongoose';

const twoFactorReplaySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
    unique: true,
    index: true,
  },
  lastCounter: {
    type: Number,
    required: true,
    min: 0,
  },
}, {
  timestamps: true,
  versionKey: false,
});

const TwoFactorReplay = mongoose.model('TwoFactorReplay', twoFactorReplaySchema);

export default TwoFactorReplay;
