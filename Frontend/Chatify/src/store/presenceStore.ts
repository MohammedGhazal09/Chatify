import { create } from 'zustand';
import type { UserOnlineStatus, TypingUser } from '../types/chat';

interface PresenceState {
  // Online users: Map<userId, UserOnlineStatus>
  onlineUsers: Map<string, UserOnlineStatus>;
  // Typing users: Map<chatId, Map<userId, TypingUser>>
  typingUsers: Map<string, Map<string, TypingUser>>;
  
  // Actions for online status
  setUserOnline: (userId: string, status: UserOnlineStatus) => void;
  setUserOffline: (userId: string, lastSeen?: string) => void;
  setMultipleOnline: (users: UserOnlineStatus[]) => void;
  isUserOnline: (userId: string) => boolean;
  getUserStatus: (userId: string) => UserOnlineStatus | undefined;
  
  // Actions for typing indicators
  setUserTyping: (chatId: string, typing: TypingUser) => void;
  clearUserTyping: (chatId: string, userId: string) => void;
  getTypingUsersForChat: (chatId: string) => TypingUser[];
  clearAllTypingForChat: (chatId: string) => void;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUsers: new Map(),
  typingUsers: new Map(),

  setUserOnline: (userId, status) => {
    set((state) => {
      const newOnlineUsers = new Map(state.onlineUsers);
      newOnlineUsers.set(userId, { ...status, isOnline: true });
      return { onlineUsers: newOnlineUsers };
    });
  },

  setUserOffline: (userId, lastSeen) => {
    set((state) => {
      const newOnlineUsers = new Map(state.onlineUsers);
      const existing = newOnlineUsers.get(userId);
      if (existing) {
        newOnlineUsers.set(userId, {
          ...existing,
          isOnline: false,
          lastSeen: lastSeen || new Date().toISOString(),
        });
      } else {
        newOnlineUsers.set(userId, {
          userId,
          isOnline: false,
          lastSeen: lastSeen || new Date().toISOString(),
        });
      }
      return { onlineUsers: newOnlineUsers };
    });
  },

  setMultipleOnline: (users) => {
    set((state) => {
      const newOnlineUsers = new Map(state.onlineUsers);
      users.forEach((user) => {
        newOnlineUsers.set(user.userId, user);
      });
      return { onlineUsers: newOnlineUsers };
    });
  },

  isUserOnline: (userId) => {
    const status = get().onlineUsers.get(userId);
    return status?.isOnline ?? false;
  },

  getUserStatus: (userId) => {
    return get().onlineUsers.get(userId);
  },

  setUserTyping: (chatId, typing) => {
    set((state) => {
      const newTypingUsers = new Map(state.typingUsers);
      if (!newTypingUsers.has(chatId)) {
        newTypingUsers.set(chatId, new Map());
      }
      const chatTyping = new Map(newTypingUsers.get(chatId)!);
      if (typing.isTyping) {
        chatTyping.set(typing.userId, typing);
      } else {
        chatTyping.delete(typing.userId);
      }
      newTypingUsers.set(chatId, chatTyping);
      return { typingUsers: newTypingUsers };
    });
  },

  clearUserTyping: (chatId, userId) => {
    set((state) => {
      const newTypingUsers = new Map(state.typingUsers);
      const chatTyping = newTypingUsers.get(chatId);
      if (chatTyping) {
        const newChatTyping = new Map(chatTyping);
        newChatTyping.delete(userId);
        newTypingUsers.set(chatId, newChatTyping);
      }
      return { typingUsers: newTypingUsers };
    });
  },

  getTypingUsersForChat: (chatId) => {
    const chatTyping = get().typingUsers.get(chatId);
    if (!chatTyping) return [];
    return Array.from(chatTyping.values());
  },

  clearAllTypingForChat: (chatId) => {
    set((state) => {
      const newTypingUsers = new Map(state.typingUsers);
      newTypingUsers.delete(chatId);
      return { typingUsers: newTypingUsers };
    });
  },
}));
