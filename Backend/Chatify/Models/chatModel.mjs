import mongoose from "mongoose";

const buildDirectKey = (members = []) => members
  .map((member) => member?.toString())
  .filter(Boolean)
  .sort()
  .join(":");

const chatSchema = new mongoose.Schema(
  {
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
    directKey: { type: String, trim: true },
    unReadMessages: {
      type: Number,
      default: 0,
    },
    chatName: { type: String },
    isGroupChat: { type: Boolean, default: false },
    latestMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Messages" },
    groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    groupImage: { type: String },
    groupDescription: { type: String },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

chatSchema.pre("validate", function setDirectKey(next) {
  if (!this.isGroupChat && this.members?.length === 2) {
    this.directKey = buildDirectKey(this.members);
  } else {
    this.directKey = undefined;
  }

  next();
});

chatSchema.index(
  { directKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isGroupChat: false,
      directKey: { $type: "string" },
    },
  }
);

const Chats = mongoose.model("Chats", chatSchema);

export default Chats;
