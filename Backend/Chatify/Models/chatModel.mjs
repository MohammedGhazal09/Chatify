import mongoose from "mongoose";
import {
  CHAT_ENCRYPTION_MODES,
  buildDirectChatKey,
  normalizeChatEncryptionMode,
} from "../Utils/encryptionMode.mjs";

const GROUP_MEMBER_MIN = 3;
const GROUP_MEMBER_MAX = 10;
const SPACE_CHANNEL_MEMBER_MIN = 1;
const SPACE_CHANNEL_MEMBER_MAX = 25;

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
    isSpaceChannel: { type: Boolean, default: false },
    space: { type: mongoose.Schema.Types.ObjectId, ref: "Spaces" },
    channelName: { type: String, trim: true },
    channelKey: { type: String, trim: true, lowercase: true },
    channelDescription: { type: String, trim: true, maxlength: 160, default: "" },
    encryptionMode: {
      type: String,
      enum: Object.values(CHAT_ENCRYPTION_MODES),
      default: CHAT_ENCRYPTION_MODES.STANDARD,
    },
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

chatSchema.pre("validate", function validateChatMembers(next) {
  const memberIds = (this.members ?? [])
    .map((member) => member?.toString())
    .filter(Boolean);
  const uniqueMemberIds = new Set(memberIds);

  this.encryptionMode = normalizeChatEncryptionMode(this.encryptionMode);

  if (this.isSpaceChannel) {
    if (memberIds.length !== uniqueMemberIds.size) {
      this.invalidate("members", "Space channel members must be unique");
    }

    if (uniqueMemberIds.size < SPACE_CHANNEL_MEMBER_MIN || uniqueMemberIds.size > SPACE_CHANNEL_MEMBER_MAX) {
      this.invalidate("members", "Space channels must have 1 to 25 members");
    }

    if (!this.space) {
      this.invalidate("space", "Space channel must belong to a space");
    }

    if (!this.channelName?.trim()) {
      this.invalidate("channelName", "Channel name is required");
    }

    this.isGroupChat = true;
    this.chatName = this.channelName?.trim();
    this.channelKey = (this.channelKey || this.chatName || "")
      .trim()
      .toLocaleLowerCase("en-US");
    this.encryptionMode = CHAT_ENCRYPTION_MODES.STANDARD;
    this.directKey = undefined;
  } else if (this.isGroupChat) {
    if (memberIds.length !== uniqueMemberIds.size) {
      this.invalidate("members", "Group members must be unique");
    }

    if (uniqueMemberIds.size < GROUP_MEMBER_MIN || uniqueMemberIds.size > GROUP_MEMBER_MAX) {
      this.invalidate("members", "Group conversations must have 3 to 10 members");
    }

    this.directKey = undefined;
  } else if (this.members?.length === 2) {
    this.directKey = buildDirectChatKey(this.members, this.encryptionMode);
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

chatSchema.index(
  { space: 1, channelKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isSpaceChannel: true,
      space: { $type: "objectId" },
      channelKey: { $type: "string" },
    },
  }
);

const Chats = mongoose.model("Chats", chatSchema);

export default Chats;
