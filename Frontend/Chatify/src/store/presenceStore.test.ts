import { beforeEach, describe, expect, it } from 'vitest';
import { usePresenceStore } from './presenceStore';

describe('presenceStore cleanup', () => {
  beforeEach(() => {
    usePresenceStore.setState({
      onlineUsers: new Map(),
      typingUsers: new Map(),
    });
  });

  it('clears online and typing state together', () => {
    const store = usePresenceStore.getState();

    store.setUserOnline('user-2', {
      userId: 'user-2',
      userName: 'Grace Hopper',
      isOnline: true,
    });
    store.setUserTyping('chat-1', {
      chatId: 'chat-1',
      userId: 'user-2',
      userName: 'Grace Hopper',
      isTyping: true,
    });

    usePresenceStore.getState().clearPresenceState();

    expect(usePresenceStore.getState().onlineUsers.size).toBe(0);
    expect(usePresenceStore.getState().typingUsers.size).toBe(0);
  });

  it('clears all typing maps without clearing online users', () => {
    const store = usePresenceStore.getState();

    store.setUserOnline('user-2', {
      userId: 'user-2',
      userName: 'Grace Hopper',
      isOnline: true,
    });
    store.setUserTyping('chat-1', {
      chatId: 'chat-1',
      userId: 'user-2',
      userName: 'Grace Hopper',
      isTyping: true,
    });

    usePresenceStore.getState().clearAllTyping();

    expect(usePresenceStore.getState().onlineUsers.size).toBe(1);
    expect(usePresenceStore.getState().typingUsers.size).toBe(0);
  });
});
