import mongoose from "mongoose";

const passwordResetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Users",
  },
  email: {
    type: String,
    required: true,
  },
  tokenHash: {
    type: String,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
  }
  }, {
    timestamps: true,
    versionKey: false
});
  
  passwordResetSchema.index({ expiresAt: 1}, { expireAfterSeconds: 0 });

  const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

  export default PasswordReset
