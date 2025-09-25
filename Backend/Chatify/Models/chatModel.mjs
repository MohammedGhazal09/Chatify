import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    unReadMessages: {
      type: Number,
      default: 0,
    },
    chatName: { type: String },
    isGroupChat: { type: Boolean, default: false },
    latestMessage: { type: mongoose.Schema.Types.ObjectId, ref: "messages" },
    groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    groupImage: { type: String },
    groupDescription: { type: String },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Chats = mongoose.model("Chats", chatSchema);

export default Chats;
