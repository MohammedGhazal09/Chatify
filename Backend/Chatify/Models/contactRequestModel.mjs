import mongoose from "mongoose";

export const CONTACT_REQUEST_STATUSES = Object.freeze({
  PENDING: "pending",
  ACCEPTED: "accepted",
  DECLINED: "declined",
  CANCELED: "canceled",
});

const contactRequestSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    pairKey: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(CONTACT_REQUEST_STATUSES),
      default: CONTACT_REQUEST_STATUSES.PENDING,
      required: true,
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chats",
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

contactRequestSchema.pre("validate", function normalizePairKey(next) {
  const requesterId = this.requester?.toString();
  const recipientId = this.recipient?.toString();

  if (requesterId && recipientId) {
    if (requesterId === recipientId) {
      this.invalidate("recipient", "Contact request recipient must be different from requester");
    }

    this.pairKey = [requesterId, recipientId].sort().join(":");
  }

  next();
});

contactRequestSchema.index(
  { pairKey: 1 },
  {
    unique: true,
    partialFilterExpression: { status: CONTACT_REQUEST_STATUSES.PENDING },
  }
);
contactRequestSchema.index({ requester: 1, status: 1, updatedAt: -1 });
contactRequestSchema.index({ recipient: 1, status: 1, updatedAt: -1 });
contactRequestSchema.index({ pairKey: 1, status: 1 });

const ContactRequest = mongoose.model("ContactRequests", contactRequestSchema);

export default ContactRequest;
