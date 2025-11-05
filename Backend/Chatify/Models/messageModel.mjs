import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Chats",
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
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

const Message = mongoose.model("Messages", messageSchema);
export default Message;