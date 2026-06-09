import { createRef } from 'react';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeChat, makeMessage } from '../../../test/chatFixtures';
import ConversationPane from './ConversationPane';

type ConversationPaneProps = ComponentProps<typeof ConversationPane>;

const renderConversationPane = (overrides: Partial<ConversationPaneProps> = {}) => {
  const props: ConversationPaneProps = {
    selectedChat: null,
    selectedChatId: null,
    currentUserId: 'user-1',
    otherMember: null,
    otherMemberStatus: null,
    messages: [],
    isMessagesLoading: false,
    messagesError: false,
    hasMore: false,
    isLoadingMore: false,
    showScrollButton: false,
    showMessageSearch: false,
    messageSearch: '',
    messageSearchResults: [],
    messageSearchNormalizedQuery: '',
    isMessageSearchLoading: false,
    isMessageSearchError: false,
    isMessageSearchBelowMinimum: false,
    loadedMessageIds: new Set(),
    editingMessageId: null,
    editText: '',
    isSavingEdit: false,
    messageInput: '',
    replyingTo: null,
    showEmojiPicker: false,
    isSending: false,
    isSendError: false,
    isOffline: false,
    isSessionExpired: false,
    isReconnecting: false,
    messagesContainerRef: createRef<HTMLDivElement>(),
    messagesEndRef: createRef<HTMLDivElement>(),
    emojiPickerRef: createRef<HTMLDivElement>(),
    onOpenSidebar: vi.fn(),
    onToggleMessageSearch: vi.fn(),
    onMessageSearchChange: vi.fn(),
    onClearMessageSearch: vi.fn(),
    onSelectMessageSearchResult: vi.fn(),
    onExportChat: vi.fn(),
    onLoadMore: vi.fn(),
    onRetryLoad: vi.fn(),
    onScrollToBottom: vi.fn(),
    onMessageContextMenu: vi.fn(),
    onOpenMessageActions: vi.fn(),
    onStartEdit: vi.fn(),
    onRetryFailed: vi.fn(),
    onDismissFailed: vi.fn(),
    onEditTextChange: vi.fn(),
    onSaveEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onComposerChange: vi.fn(),
    onComposerKeyDown: vi.fn(),
    onSendMessage: vi.fn(),
    onToggleEmojiPicker: vi.fn(),
    onAppendEmoji: vi.fn(),
    onCancelReply: vi.fn(),
    ...overrides,
  };

  render(<ConversationPane {...props} />);
  return props;
};

describe('ConversationPane', () => {
  it('renders the no selected chat state', () => {
    renderConversationPane();

    expect(screen.getByRole('heading', { name: 'Select a conversation' })).toBeInTheDocument();
    expect(screen.getByText('Choose a chat from the sidebar or start a new one.')).toBeInTheDocument();
  });

  it('renders the session-expired blocked state with a sign-in action', () => {
    renderConversationPane({
      selectedChat: makeChat(),
      selectedChatId: 'chat-1',
      isSessionExpired: true,
    });

    expect(screen.getByRole('heading', { name: 'Your session expired' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('labels the conversation search input', () => {
    renderConversationPane({
      selectedChat: makeChat(),
      selectedChatId: 'chat-1',
      showMessageSearch: true,
      messageSearch: 'state',
    });

    expect(screen.getByRole('textbox', { name: 'Search messages in this conversation' })).toHaveValue('state');
  });

  it('renders below-minimum search guidance outside the durable message list', () => {
    renderConversationPane({
      selectedChat: makeChat(),
      selectedChatId: 'chat-1',
      messages: [makeMessage({ text: 'Durable history stays visible only outside result mode' })],
      showMessageSearch: true,
      messageSearch: 'a',
      isMessageSearchBelowMinimum: true,
    });

    expect(screen.getByText('Type at least 2 characters to search this conversation.')).toBeInTheDocument();
    expect(screen.queryByText('Durable history stays visible only outside result mode')).not.toBeInTheDocument();
  });

  it('renders server-backed message search results and clear action', async () => {
    const user = userEvent.setup();
    const onClearMessageSearch = vi.fn();

    renderConversationPane({
      selectedChat: makeChat(),
      selectedChatId: 'chat-1',
      showMessageSearch: true,
      messageSearch: 'launch',
      messageSearchNormalizedQuery: 'launch',
      messageSearchResults: [
        makeMessage({ _id: 'message-loaded', text: 'Launch result already loaded' }),
        makeMessage({ _id: 'message-older', text: 'Older launch result' }),
      ],
      loadedMessageIds: new Set(['message-loaded']),
      onClearMessageSearch,
    });

    expect(screen.getByText('Found 2 messages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Jump to message: Launch result already loaded/ })).toBeInTheDocument();
    expect(screen.getByText((_content, element) => element?.textContent === 'Older launch result')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear message search' }));
    expect(onClearMessageSearch).toHaveBeenCalledTimes(1);
  });

  it('selects only loaded search results as keyboard-operable actions', async () => {
    const user = userEvent.setup();
    const onSelectMessageSearchResult = vi.fn();
    const loadedMessage = makeMessage({ _id: 'message-loaded', text: 'Loaded search result' });

    renderConversationPane({
      selectedChat: makeChat(),
      selectedChatId: 'chat-1',
      showMessageSearch: true,
      messageSearch: 'loaded',
      messageSearchNormalizedQuery: 'loaded',
      messageSearchResults: [
        loadedMessage,
        makeMessage({ _id: 'message-older', text: 'Older unloaded result' }),
      ],
      loadedMessageIds: new Set(['message-loaded']),
      onSelectMessageSearchResult,
    });

    await user.click(screen.getByRole('button', { name: /Jump to message: Loaded search result/ }));

    expect(onSelectMessageSearchResult).toHaveBeenCalledWith(loadedMessage);
    expect(screen.queryByRole('button', { name: /Older unloaded result/ })).not.toBeInTheDocument();
  });
});
