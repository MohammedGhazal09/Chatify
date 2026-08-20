import mongoose from 'mongoose';

const userBlockSchema = new mongoose.Schema(
  {
    blocker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    blockedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    sourceChatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chats',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userBlockSchema.index({ blocker: 1, blockedUser: 1 }, { unique: true });
userBlockSchema.index({ blockedUser: 1, blocker: 1 });
userBlockSchema.index({ sourceChatId: 1, blocker: 1 });

const UserBlock = mongoose.model('UserBlocks', userBlockSchema);

export default UserBlock;
