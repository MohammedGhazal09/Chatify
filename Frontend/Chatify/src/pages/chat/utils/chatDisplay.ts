import type { Chat } from '../../../types/chat';

export const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const formatMessageDate = (timestamp: string) => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
};

export const isDifferentDay = (date1: string, date2: string) => {
  return new Date(date1).toDateString() !== new Date(date2).toDateString();
};

export const getChatTitle = (chat: Chat, userId: string | undefined) => {
  if (chat.isSpaceChannel) {
    return chat.channelName || chat.chatName || 'Channel';
  }

  if (chat.isGroupChat && chat.chatName) {
    return chat.chatName;
  }

  const otherMember = chat.members.find((member) => member._id !== userId);
  if (!otherMember) {
    return chat.chatName || 'Unknown chat';
  }

  return `${otherMember.firstName} ${otherMember.lastName ?? ''}`.trim();
};

export const getOtherMember = (chat: Chat, userId: string | undefined) => {
  if (chat.isGroupChat) return null;
  return chat.members.find((member) => member._id !== userId) || null;
};
