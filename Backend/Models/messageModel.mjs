import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "chats",
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
  },
  text: {
    type: String,
    required: true,
  },
  read: {
    type: Boolean,
    default: false,
  }
}, {
  timestamps: true,
  versionKey: false,
});

const Message = mongoose.model("Message", messageSchema);
export default Message;