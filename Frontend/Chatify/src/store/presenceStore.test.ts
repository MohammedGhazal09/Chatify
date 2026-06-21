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

  it('clears stale profile status when an offline presence event omits it', () => {
    const store = usePresenceStore.getState();

    store.setUserOnline('user-2', {
      userId: 'user-2',
      userName: 'Grace Hopper',
      isOnline: true,
      profileStatus: 'Available for focused work',
    });

    store.setUserOffline('user-2', '2026-06-20T01:00:00.000Z');

    expect(usePresenceStore.getState().onlineUsers.get('user-2')).toMatchObject({
      isOnline: false,
      lastSeen: '2026-06-20T01:00:00.000Z',
    });
    expect(usePresenceStore.getState().onlineUsers.get('user-2')?.profileStatus).toBeUndefined();
  });
});
