import { createRef } from 'react';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ConversationControls } from '../../../types/chat';
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
    highlightedMessageId: null,
    showScrollButton: false,
    showMessageSearch: false,
    showConversationMoreMenu: false,
    showConversationDetails: false,
    conversationControls: undefined,
    messageSearch: '',
    messageSearchInputRef: createRef<HTMLInputElement>(),
    messageSearchButtonRef: createRef<HTMLButtonElement>(),
    moreButtonRef: createRef<HTMLButtonElement>(),
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
    sendDisabledReason: null,
    isConversationControlPending: false,
    composerResetToken: 0,
    isOffline: false,
    isSessionExpired: false,
    isReconnecting: false,
    messagesContainerRef: createRef<HTMLDivElement>(),
    messagesEndRef: createRef<HTMLDivElement>(),
    emojiPickerRef: createRef<HTMLDivElement>(),
    onOpenSidebar: vi.fn(),
    onStartAudioCall: vi.fn(),
    onStartVideoCall: vi.fn(),
    onToggleConversationMoreMenu: vi.fn(),
    onToggleConversationDetails: vi.fn(),
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
    onOpenAttachmentPreview: vi.fn(),
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
    onUnblockUser: vi.fn(),
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

  it('hides private messages and composer content when the session is expired', () => {
    renderConversationPane({
      selectedChat: makeChat(),
      selectedChatId: 'chat-1',
      isSessionExpired: true,
      messages: [makeMessage({ text: 'Private message content' })],
      messageInput: 'private draft',
    });

    expect(screen.getByRole('heading', { name: 'Your session expired' })).toBeInTheDocument();
    expect(screen.queryByText('Private message content')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Write a private message' })).not.toBeInTheDocument();
  });

  it('labels the conversation search input', () => {
    renderConversationPane({
      selectedChat: makeChat(),
      selectedChatId: 'chat-1',
      showMessageSearch: true,
      messageSearch: 'state',
    });

    expect(screen.getByRole('textbox', { name: 'Search this conversation' })).toHaveValue('state');
  });

  it('closes the active conversation search from the input row', async () => {
    const user = userEvent.setup();
    const onToggleMessageSearch = vi.fn();

    renderConversationPane({
      selectedChat: makeChat(),
      selectedChatId: 'chat-1',
      showMessageSearch: true,
      messageSearch: 'state',
      onToggleMessageSearch,
    });

    await user.click(screen.getByRole('button', { name: 'Close message search' }));

    expect(onToggleMessageSearch).toHaveBeenCalledTimes(1);
  });

  it('toggles conversation details from the top-right header action', async () => {
    const user = userEvent.setup();
    const onToggleConversationDetails = vi.fn();

    renderConversationPane({
      selectedChat: makeChat(),
      selectedChatId: 'chat-1',
      onToggleConversationDetails,
    });

    await user.click(screen.getByRole('button', { name: 'Open conversation details' }));

    expect(onToggleConversationDetails).toHaveBeenCalledTimes(1);
  });

  it('pins blocked-by-me status above the conversation and removes the old composer-only copy', async () => {
    const user = userEvent.setup();
    const onUnblockUser = vi.fn();
    const chat = makeChat();
    const blockedControls: ConversationControls = {
      isDirectChat: true,
      peerId: 'user-2',
      canSendMessage: false,
      canBlockUser: false,
      canUnblockUser: true,
      blockedByMe: true,
      blockedMe: false,
      messagingDisabledReason: 'blocked_by_me',
    };

    renderConversationPane({
      selectedChat: chat,
      selectedChatId: chat._id,
      otherMember: chat.members[1] ?? null,
      conversationControls: blockedControls,
      sendDisabledReason: 'You blocked this user. Unblock them to send new activity.',
      onUnblockUser,
    });

    expect(screen.getByRole('alert')).toHaveTextContent('You blocked Grace Hopper');
    expect(screen.getByRole('alert')).toHaveTextContent('New messages, calls, reactions, pins, and edits stay paused until you unblock them.');
    expect(screen.getByRole('textbox', { name: 'Write a private message' })).toBeDisabled();
    expect(screen.queryByText('You blocked this user. Unblock them to send new activity.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Unblock user' }));
    expect(onUnblockUser).toHaveBeenCalledTimes(1);
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

    expect(screen.getByText('Type at least 2 characters to search.')).toBeInTheDocument();
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
        makeMessage({ _id: 'message-loaded', sender: 'user-2', text: 'Launch result already loaded' }),
        makeMessage({ _id: 'message-older', sender: 'user-2', text: 'Older launch result' }),
      ],
      loadedMessageIds: new Set(['message-loaded']),
      onClearMessageSearch,
    });

    expect(screen.getByText('2 results')).toBeInTheDocument();
    expect(screen.getAllByText('Grace Hopper').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: /Jump to message from Grace Hopper .*Launch result already loaded/ })).toBeInTheDocument();
    expect(screen.getAllByText((_content, element) => element?.textContent === 'Older launch result').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onClearMessageSearch).toHaveBeenCalledTimes(1);
  });

  it('selects only loaded search results as keyboard-operable actions', async () => {
    const user = userEvent.setup();
    const onSelectMessageSearchResult = vi.fn();
    const loadedMessage = makeMessage({ _id: 'message-loaded', sender: 'user-2', text: 'Loaded search result' });

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

    await user.click(screen.getByRole('button', { name: /Jump to message from Grace Hopper .*Loaded search result/ }));

    expect(onSelectMessageSearchResult).toHaveBeenCalledWith(loadedMessage);
    expect(screen.queryByRole('button', { name: /Older unloaded result/ })).not.toBeInTheDocument();
  });
});
