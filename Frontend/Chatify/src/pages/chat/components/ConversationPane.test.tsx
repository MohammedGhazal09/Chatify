import { createRef } from 'react';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeChat } from '../../../test/chatFixtures';
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
});
