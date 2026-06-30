import { useEffect, useMemo, useRef, useState } from 'react';

interface ConversationDraftRecord {
  text: string;
  updatedAt: string;
}

interface UseConversationDraftsOptions {
  userId?: string | null;
  selectedChatId: string | null;
  messageInput: string;
  setMessageInput: (value: string) => void;
  accessibleChatIds?: string[];
}

type ConversationDraftRecords = Record<string, ConversationDraftRecord>;

const MAX_STORED_DRAFT_LENGTH = 4000;

export const getConversationDraftsStorageKey = (userId: string) => `chatify_message_drafts:${userId}`;

const hasStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const normalizeDraftText = (text: string) => text.slice(0, MAX_STORED_DRAFT_LENGTH);

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const normalizeDraftRecords = (value: unknown): ConversationDraftRecords => {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.entries(value).reduce<ConversationDraftRecords>((drafts, [chatId, draft]) => {
    if (!chatId || !isPlainObject(draft) || typeof draft.text !== 'string' || !draft.text.trim()) {
      return drafts;
    }

    drafts[chatId] = {
      text: normalizeDraftText(draft.text),
      updatedAt: typeof draft.updatedAt === 'string' ? draft.updatedAt : new Date(0).toISOString(),
    };

    return drafts;
  }, {});
};

const areDraftRecordsEqual = (left: ConversationDraftRecords, right: ConversationDraftRecords) => {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  return leftEntries.every(([chatId, draft]) => (
    right[chatId]?.text === draft.text && right[chatId]?.updatedAt === draft.updatedAt
  ));
};

export const readStoredConversationDrafts = (userId?: string | null): ConversationDraftRecords => {
  if (!userId || !hasStorage()) {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(getConversationDraftsStorageKey(userId));
    return rawValue ? normalizeDraftRecords(JSON.parse(rawValue)) : {};
  } catch {
    return {};
  }
};

const writeStoredConversationDrafts = (userId: string, drafts: ConversationDraftRecords) => {
  if (!hasStorage()) {
    return;
  }

  try {
    const storageKey = getConversationDraftsStorageKey(userId);

    if (Object.keys(drafts).length > 0) {
      window.localStorage.setItem(storageKey, JSON.stringify(drafts));
    } else {
      window.localStorage.removeItem(storageKey);
    }
  } catch {
    // Drafts still work in memory when browser storage is unavailable.
  }
};

export const clearStoredConversationDrafts = (userId?: string | null) => {
  if (!userId || !hasStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(getConversationDraftsStorageKey(userId));
  } catch {
    // Ignore storage failures during logout/session cleanup.
  }
};

const pruneDrafts = (
  drafts: ConversationDraftRecords,
  accessibleChatIds: ReadonlySet<string> | null
) => {
  if (!accessibleChatIds) {
    return drafts;
  }

  return Object.entries(drafts).reduce<ConversationDraftRecords>((nextDrafts, [chatId, draft]) => {
    if (accessibleChatIds.has(chatId)) {
      nextDrafts[chatId] = draft;
    }
    return nextDrafts;
  }, {});
};

const toDraftTextMap = (drafts: ConversationDraftRecords) => (
  Object.entries(drafts).reduce<Record<string, string>>((draftTextMap, [chatId, draft]) => {
    draftTextMap[chatId] = draft.text;
    return draftTextMap;
  }, {})
);

export const useConversationDrafts = ({
  userId,
  selectedChatId,
  messageInput,
  setMessageInput,
  accessibleChatIds,
}: UseConversationDraftsOptions) => {
  const accessibleChatKey = useMemo(
    () => (accessibleChatIds && accessibleChatIds.length > 0 ? [...accessibleChatIds].sort().join('|') : ''),
    [accessibleChatIds]
  );
  const accessibleChatSet = useMemo(
    () => (accessibleChatKey ? new Set(accessibleChatKey.split('|')) : null),
    [accessibleChatKey]
  );
  const [storedDrafts, setStoredDrafts] = useState<ConversationDraftRecords>(() => (
    pruneDrafts(readStoredConversationDrafts(userId), accessibleChatSet)
  ));
  const restoredSelectionRef = useRef<{ userId: string | null; chatId: string | null; draftText: string }>({
    userId: null,
    chatId: null,
    draftText: '',
  });
  const messageInputRef = useRef(messageInput);
  const skipNextPersistRef = useRef(false);

  useEffect(() => {
    messageInputRef.current = messageInput;
  }, [messageInput]);

  useEffect(() => {
    if (!userId) {
      setStoredDrafts({});
      restoredSelectionRef.current = { userId: null, chatId: null, draftText: '' };
      return;
    }

    const stored = readStoredConversationDrafts(userId);
    const pruned = pruneDrafts(stored, accessibleChatSet);
    if (!areDraftRecordsEqual(stored, pruned)) {
      writeStoredConversationDrafts(userId, pruned);
    }

    setStoredDrafts(pruned);
    restoredSelectionRef.current = { userId: null, chatId: null, draftText: '' };
  }, [accessibleChatSet, userId]);

  useEffect(() => {
    const draftText = userId && selectedChatId ? storedDrafts[selectedChatId]?.text ?? '' : '';
    const nextSelection = {
      userId: userId ?? null,
      chatId: selectedChatId,
      draftText,
    };

    if (
      restoredSelectionRef.current.userId === nextSelection.userId &&
      restoredSelectionRef.current.chatId === nextSelection.chatId
    ) {
      if (restoredSelectionRef.current.draftText === draftText) {
        return;
      }

      if (messageInputRef.current === draftText || messageInputRef.current.trim()) {
        restoredSelectionRef.current = nextSelection;
        return;
      }
    }

    restoredSelectionRef.current = nextSelection;
    skipNextPersistRef.current = true;
    setMessageInput(draftText);
  }, [selectedChatId, setMessageInput, storedDrafts, userId]);

  useEffect(() => {
    if (!userId || !selectedChatId) {
      return;
    }

    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }

    setStoredDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };

      if (messageInput.trim()) {
        nextDrafts[selectedChatId] = {
          text: normalizeDraftText(messageInput),
          updatedAt: new Date().toISOString(),
        };
      } else {
        delete nextDrafts[selectedChatId];
      }

      if (areDraftRecordsEqual(currentDrafts, nextDrafts)) {
        return currentDrafts;
      }

      writeStoredConversationDrafts(userId, nextDrafts);
      return nextDrafts;
    });
  }, [messageInput, selectedChatId, userId]);

  const draftsByChatId = useMemo(() => toDraftTextMap(storedDrafts), [storedDrafts]);

  return {
    draftsByChatId,
  };
};
