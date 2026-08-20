import { useState } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeChat } from '../../../test/chatFixtures';
import {
  getSelectedChatStorageKey,
  useSelectedChatPersistence,
} from './useSelectedChatPersistence';

const chats = [
  makeChat({ _id: 'chat-1', updatedAt: '2026-06-09T10:00:00.000Z' }),
  makeChat({ _id: 'chat-2', updatedAt: '2026-06-09T09:00:00.000Z' }),
];

const renderPersistenceHook = ({
  userId = 'user-1',
  initialSelectedChatId = null,
  loadedChats = chats,
}: {
  userId?: string | null;
  initialSelectedChatId?: string | null;
  loadedChats?: typeof chats;
} = {}) => {
  const setSelectedChatSpy = vi.fn();

  const hook = renderHook(() => {
    const [selectedChatId, setSelectedChatId] = useState<string | null>(initialSelectedChatId);
    const wrappedSetSelectedChatId = (nextChatId: string | null) => {
      setSelectedChatSpy(nextChatId);
      setSelectedChatId(nextChatId);
    };

    useSelectedChatPersistence({
      userId,
      chats: loadedChats,
      isChatsLoading: false,
      selectedChatId,
      setSelectedChatId: wrappedSetSelectedChatId,
    });

    return {
      selectedChatId,
      setSelectedChatId: wrappedSetSelectedChatId,
    };
  });

  return { ...hook, setSelectedChatSpy };
};

describe('useSelectedChatPersistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('restores URL chatId before per-user localStorage', async () => {
    window.history.replaceState(null, '', '/?chatId=chat-2');
    window.localStorage.setItem(getSelectedChatStorageKey('user-1'), 'chat-1');

    const { result } = renderPersistenceHook();

    await waitFor(() => {
      expect(result.current.selectedChatId).toBe('chat-2');
    });
    expect(window.localStorage.getItem(getSelectedChatStorageKey('user-1'))).toBe('chat-2');
    expect(new URLSearchParams(window.location.search).get('chatId')).toBe('chat-2');
  });

  it('restores per-user localStorage when URL has no chatId', async () => {
    window.localStorage.setItem(getSelectedChatStorageKey('user-1'), 'chat-2');

    const { result } = renderPersistenceHook();

    await waitFor(() => {
      expect(result.current.selectedChatId).toBe('chat-2');
    });
    expect(new URLSearchParams(window.location.search).get('chatId')).toBe('chat-2');
  });

  it('falls back to the most recent accessible chat', async () => {
    const { result } = renderPersistenceHook();

    await waitFor(() => {
      expect(result.current.selectedChatId).toBe('chat-1');
    });
  });

  it('removes invalid URL chatId and falls back safely', async () => {
    window.history.replaceState(null, '', '/?chatId=not-accessible');
    window.localStorage.setItem(getSelectedChatStorageKey('user-1'), 'chat-2');

    const { result } = renderPersistenceHook();

    await waitFor(() => {
      expect(result.current.selectedChatId).toBe('chat-2');
    });
    expect(window.location.search).toBe('?chatId=chat-2');
  });

  it('updates URL and per-user storage when selection changes', async () => {
    const { result } = renderPersistenceHook();

    await waitFor(() => {
      expect(result.current.selectedChatId).toBe('chat-1');
    });

    act(() => {
      result.current.setSelectedChatId('chat-2');
    });

    await waitFor(() => {
      expect(window.localStorage.getItem(getSelectedChatStorageKey('user-1'))).toBe('chat-2');
    });
    expect(new URLSearchParams(window.location.search).get('chatId')).toBe('chat-2');
  });

  it('does not restore another user storage key', async () => {
    window.localStorage.setItem(getSelectedChatStorageKey('user-2'), 'chat-2');

    const { result } = renderPersistenceHook({ userId: 'user-1' });

    await waitFor(() => {
      expect(result.current.selectedChatId).toBe('chat-1');
    });
    expect(window.localStorage.getItem(getSelectedChatStorageKey('user-1'))).toBe('chat-1');
  });
});
