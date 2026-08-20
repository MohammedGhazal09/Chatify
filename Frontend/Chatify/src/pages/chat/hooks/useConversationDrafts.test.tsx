import { useState } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStoredConversationDrafts,
  getConversationDraftsStorageKey,
  useConversationDrafts,
} from './useConversationDrafts';

const renderDraftHook = ({
  userId = 'user-1',
  initialSelectedChatId = 'chat-1',
  accessibleChatIds = ['chat-1', 'chat-2'],
}: {
  userId?: string | null;
  initialSelectedChatId?: string | null;
  accessibleChatIds?: string[];
} = {}) => {
  const hook = renderHook(() => {
    const [selectedChatId, setSelectedChatId] = useState<string | null>(initialSelectedChatId);
    const [messageInput, setMessageInput] = useState('');
    const draftState = useConversationDrafts({
      userId,
      selectedChatId,
      messageInput,
      setMessageInput,
      accessibleChatIds,
    });

    return {
      ...draftState,
      messageInput,
      selectedChatId,
      setMessageInput,
      setSelectedChatId,
    };
  });

  return hook;
};

const readDraftStorage = (userId = 'user-1') => {
  const rawValue = window.localStorage.getItem(getConversationDraftsStorageKey(userId));
  return rawValue ? JSON.parse(rawValue) as Record<string, { text: string }> : {};
};

describe('useConversationDrafts', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('restores the selected chat draft from per-user storage', async () => {
    window.localStorage.setItem(getConversationDraftsStorageKey('user-1'), JSON.stringify({
      'chat-1': {
        text: 'Saved before reload',
        updatedAt: '2026-06-30T01:00:00.000Z',
      },
    }));

    const { result } = renderDraftHook();

    await waitFor(() => {
      expect(result.current.messageInput).toBe('Saved before reload');
    });
  });

  it('restores after the authenticated user becomes available', async () => {
    window.localStorage.setItem(getConversationDraftsStorageKey('user-1'), JSON.stringify({
      'chat-1': {
        text: 'Saved after auth init',
        updatedAt: '2026-06-30T01:00:00.000Z',
      },
    }));

    const { result } = renderHook(() => {
      const [userId, setUserId] = useState<string | null>(null);
      const [messageInput, setMessageInput] = useState('');
      const draftState = useConversationDrafts({
        userId,
        selectedChatId: 'chat-1',
        messageInput,
        setMessageInput,
        accessibleChatIds: ['chat-1'],
      });

      return {
        ...draftState,
        messageInput,
        setUserId,
      };
    });

    expect(result.current.messageInput).toBe('');

    act(() => {
      result.current.setUserId('user-1');
    });

    await waitFor(() => {
      expect(result.current.messageInput).toBe('Saved after auth init');
    });
  });

  it('keeps separate drafts when switching conversations', async () => {
    const { result } = renderDraftHook();

    act(() => {
      result.current.setMessageInput('Draft for chat one');
    });

    await waitFor(() => {
      expect(readDraftStorage()['chat-1'].text).toBe('Draft for chat one');
    });

    act(() => {
      result.current.setSelectedChatId('chat-2');
    });

    await waitFor(() => {
      expect(result.current.messageInput).toBe('');
    });

    act(() => {
      result.current.setMessageInput('Draft for chat two');
    });

    await waitFor(() => {
      expect(readDraftStorage()['chat-2'].text).toBe('Draft for chat two');
    });

    act(() => {
      result.current.setSelectedChatId('chat-1');
    });

    await waitFor(() => {
      expect(result.current.messageInput).toBe('Draft for chat one');
    });
  });

  it('removes the active draft when the composer becomes empty and preserves other drafts', async () => {
    window.localStorage.setItem(getConversationDraftsStorageKey('user-1'), JSON.stringify({
      'chat-1': {
        text: 'Active draft',
        updatedAt: '2026-06-30T01:00:00.000Z',
      },
      'chat-2': {
        text: 'Other draft',
        updatedAt: '2026-06-30T01:01:00.000Z',
      },
    }));

    const { result } = renderDraftHook();

    await waitFor(() => {
      expect(result.current.messageInput).toBe('Active draft');
    });

    act(() => {
      result.current.setMessageInput('');
    });

    await waitFor(() => {
      const storage = readDraftStorage();
      expect(storage['chat-1']).toBeUndefined();
      expect(storage['chat-2'].text).toBe('Other draft');
    });
  });

  it('does not restore another user draft storage key', async () => {
    window.localStorage.setItem(getConversationDraftsStorageKey('user-2'), JSON.stringify({
      'chat-1': {
        text: 'Other account draft',
        updatedAt: '2026-06-30T01:00:00.000Z',
      },
    }));

    const { result } = renderDraftHook({ userId: 'user-1' });

    await waitFor(() => {
      expect(result.current.messageInput).toBe('');
    });
    expect(result.current.draftsByChatId['chat-1']).toBeUndefined();
  });

  it('prunes inaccessible chat drafts after accessible chats are known', async () => {
    window.localStorage.setItem(getConversationDraftsStorageKey('user-1'), JSON.stringify({
      'chat-1': {
        text: 'Accessible draft',
        updatedAt: '2026-06-30T01:00:00.000Z',
      },
      'chat-deleted': {
        text: 'Deleted chat draft',
        updatedAt: '2026-06-30T01:01:00.000Z',
      },
    }));

    const { result } = renderDraftHook({ accessibleChatIds: ['chat-1'] });

    await waitFor(() => {
      expect(result.current.draftsByChatId['chat-1']).toBe('Accessible draft');
    });

    const storage = readDraftStorage();
    expect(storage['chat-1'].text).toBe('Accessible draft');
    expect(storage['chat-deleted']).toBeUndefined();
  });

  it('keeps in-memory drafts when localStorage writes fail', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    const { result } = renderDraftHook();

    act(() => {
      result.current.setMessageInput('Memory only draft');
    });

    await waitFor(() => {
      expect(result.current.draftsByChatId['chat-1']).toBe('Memory only draft');
    });
    expect(window.localStorage.getItem(getConversationDraftsStorageKey('user-1'))).toBeNull();
  });

  it('clears a user draft storage key', () => {
    window.localStorage.setItem(getConversationDraftsStorageKey('user-1'), JSON.stringify({
      'chat-1': {
        text: 'Stored draft',
        updatedAt: '2026-06-30T01:00:00.000Z',
      },
    }));

    clearStoredConversationDrafts('user-1');

    expect(window.localStorage.getItem(getConversationDraftsStorageKey('user-1'))).toBeNull();
  });
});
