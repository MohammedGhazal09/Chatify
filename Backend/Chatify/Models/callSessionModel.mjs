import mongoose from 'mongoose';

const callSessionSchema = new mongoose.Schema(
  {
    callId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chats',
      required: true,
    },
    callerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    calleeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
    },
    recipientIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
    }],
    participantIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
    }],
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
    },
    isGroupCall: {
      type: Boolean,
      default: false,
    },
    mode: {
      type: String,
      enum: ['audio', 'video'],
      required: true,
    },
    status: {
      type: String,
      enum: ['ringing', 'connected', 'rejected', 'missed', 'ended', 'failed', 'canceled', 'blocked'],
      default: 'ringing',
      required: true,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    ringingAt: {
      type: Date,
      required: true,
    },
    answeredAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    endedReason: {
      type: String,
      trim: true,
    },
    deliveredTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
    }],
    durationSeconds: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

callSessionSchema.index({ chatId: 1, createdAt: -1 });
callSessionSchema.index({ callerId: 1, status: 1, createdAt: -1 });
callSessionSchema.index({ calleeId: 1, status: 1, createdAt: -1 });
callSessionSchema.index({ participantIds: 1, status: 1, createdAt: -1 });
callSessionSchema.index({ chatId: 1, status: 1, createdAt: -1 });

const CallSession = mongoose.model('CallSessions', callSessionSchema);

export default CallSession;
