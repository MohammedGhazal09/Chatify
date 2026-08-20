import mongoose from 'mongoose';

const savedMessageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
    index: true,
  },
  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Messages',
    required: true,
    index: true,
  },
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chats',
    required: true,
    index: true,
  },
  savedAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
}, {
  timestamps: true,
  versionKey: false,
});

savedMessageSchema.index({ user: 1, message: 1 }, { unique: true });
savedMessageSchema.index({ user: 1, savedAt: -1, _id: -1 });
savedMessageSchema.index({ chat: 1, user: 1 });

const SavedMessage = mongoose.model('SavedMessages', savedMessageSchema);
export default SavedMessage;
