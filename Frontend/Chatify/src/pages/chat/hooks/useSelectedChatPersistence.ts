import { useEffect, useMemo, useRef } from 'react';
import type { Chat } from '../../../types/chat';

interface UseSelectedChatPersistenceOptions {
  userId?: string | null;
  chats: Chat[] | undefined;
  isChatsLoading: boolean;
  selectedChatId: string | null;
  setSelectedChatId: (chatId: string | null) => void;
}

export const getSelectedChatStorageKey = (userId: string) => `chatify_selected_chat_${userId}`;

const getUrlChatId = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return new URLSearchParams(window.location.search).get('chatId');
};

export const replaceSelectedChatUrl = (chatId: string | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);

  if (chatId) {
    url.searchParams.set('chatId', chatId);
  } else {
    url.searchParams.delete('chatId');
  }

  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
};

const readStoredChatId = (userId: string) => {
  try {
    return window.localStorage.getItem(getSelectedChatStorageKey(userId));
  } catch {
    return null;
  }
};

const writeStoredChatId = (userId: string, chatId: string | null) => {
  try {
    const storageKey = getSelectedChatStorageKey(userId);

    if (chatId) {
      window.localStorage.setItem(storageKey, chatId);
    } else {
      window.localStorage.removeItem(storageKey);
    }
  } catch {
    // Ignore localStorage failures; URL and in-memory selection still work.
  }
};

const getMostRecentChatId = (chats: Chat[]) => {
  return [...chats]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0]?._id ?? null;
};

export const useSelectedChatPersistence = ({
  userId,
  chats,
  isChatsLoading,
  selectedChatId,
  setSelectedChatId,
}: UseSelectedChatPersistenceOptions) => {
  const restoredUserRef = useRef<string | null>(null);
  const accessibleChatIds = useMemo(() => new Set((chats ?? []).map((chat) => chat._id)), [chats]);

  useEffect(() => {
    if (restoredUserRef.current !== userId) {
      restoredUserRef.current = null;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || isChatsLoading || !chats) {
      return;
    }

    if (chats.length === 0) {
      restoredUserRef.current = userId;
      if (selectedChatId) {
        setSelectedChatId(null);
      }
      writeStoredChatId(userId, null);
      replaceSelectedChatUrl(null);
      return;
    }

    const isAccessible = (chatId: string | null | undefined) => Boolean(chatId && accessibleChatIds.has(chatId));

    if (restoredUserRef.current !== userId) {
      const urlChatId = getUrlChatId();
      const storedChatId = readStoredChatId(userId);
      const fallbackChatId = isAccessible(selectedChatId) ? selectedChatId : getMostRecentChatId(chats);
      const nextChatId = isAccessible(urlChatId)
        ? urlChatId
        : isAccessible(storedChatId)
          ? storedChatId
          : fallbackChatId;

      restoredUserRef.current = userId;

      if (urlChatId && !isAccessible(urlChatId)) {
        replaceSelectedChatUrl(null);
      }

      if (nextChatId !== selectedChatId) {
        setSelectedChatId(nextChatId);
      }

      writeStoredChatId(userId, nextChatId);
      replaceSelectedChatUrl(nextChatId);
      return;
    }

    if (isAccessible(selectedChatId)) {
      writeStoredChatId(userId, selectedChatId);
      replaceSelectedChatUrl(selectedChatId);
      return;
    }

    const fallbackChatId = getMostRecentChatId(chats);
    setSelectedChatId(fallbackChatId);
    writeStoredChatId(userId, fallbackChatId);
    replaceSelectedChatUrl(fallbackChatId);
  }, [accessibleChatIds, chats, isChatsLoading, selectedChatId, setSelectedChatId, userId]);
};
