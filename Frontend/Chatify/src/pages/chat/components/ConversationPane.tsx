import type { ChangeEvent, KeyboardEventHandler, RefObject } from 'react';
import type { Chat, ComposerSendPayload, ConversationControls, Message, UserOnlineStatus } from '../../../types/chat';
import type { User } from '../../../types/auth';
import TypingIndicator from '../../../components/TypingIndicator';
import { getChatTitle } from '../utils/chatDisplay';
import ChatStateView from './ChatStateView';
import ConversationHeader from './ConversationHeader';
import MessageComposer from './MessageComposer';
import MessageList from './MessageList';
import MessageSearchResults from './MessageSearchResults';

interface ConversationPaneProps {
  selectedChat: Chat | null;
  selectedChatId: string | null;
  currentUserId?: string;
  otherMember: User | null;
  otherMemberStatus: UserOnlineStatus | null;
  messages: Message[];
  isMessagesLoading: boolean;
  messagesError: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  highlightedMessageId: string | null;
  showScrollButton: boolean;
  showMessageSearch: boolean;
  showConversationMoreMenu: boolean;
  conversationControls?: ConversationControls;
  callDisabledReason?: string | null;
  videoCallDisabledReason?: string | null;
  messageSearch: string;
  messageSearchInputRef: RefObject<HTMLInputElement | null>;
  messageSearchButtonRef: RefObject<HTMLButtonElement | null>;
  moreButtonRef?: RefObject<HTMLButtonElement | null>;
  messageSearchResults: Message[];
  messageSearchNormalizedQuery: string;
  isMessageSearchLoading: boolean;
  isMessageSearchError: boolean;
  isMessageSearchBelowMinimum: boolean;
  loadedMessageIds: ReadonlySet<string>;
  editingMessageId: string | null;
  editText: string;
  isSavingEdit: boolean;
  messageInput: string;
  replyingTo: Message | null;
  showEmojiPicker: boolean;
  isSending: boolean;
  isSendError: boolean;
  sendDisabledReason?: string | null;
  composerResetToken: number;
  isOffline: boolean;
  isSessionExpired: boolean;
  isReconnecting: boolean;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  emojiPickerRef: RefObject<HTMLDivElement | null>;
  onOpenSidebar: () => void;
  onStartAudioCall: () => void;
  onStartVideoCall: () => void;
  onToggleConversationMoreMenu: () => void;
  onToggleMessageSearch: () => void;
  onMessageSearchChange: (value: string) => void;
  onClearMessageSearch: () => void;
  onSelectMessageSearchResult: (message: Message) => void;
  onExportChat: () => void;
  onLoadMore: () => void;
  onRetryLoad: () => void;
  onScrollToBottom: () => void;
  onMessageContextMenu: MessageListProps['onMessageContextMenu'];
  onOpenMessageActions: MessageListProps['onOpenMessageActions'];
  onStartEdit: (messageId: string, currentText: string) => void;
  onRetryFailed: (message: Message) => void;
  onDismissFailed: (message: Message) => void;
  onEditTextChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onComposerChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onComposerKeyDown: (event: Parameters<KeyboardEventHandler<HTMLTextAreaElement>>[0], payload: ComposerSendPayload) => void;
  onSendMessage: (payload: ComposerSendPayload) => void;
  onToggleEmojiPicker: () => void;
  onAppendEmoji: (emoji: string) => void;
  onCancelReply: () => void;
}

type MessageListProps = Parameters<typeof MessageList>[0];

const ConversationPane = ({
  selectedChat,
  selectedChatId,
  currentUserId,
  otherMember,
  otherMemberStatus,
  messages,
  isMessagesLoading,
  messagesError,
  hasMore,
  isLoadingMore,
  highlightedMessageId,
  showScrollButton,
  showMessageSearch,
  showConversationMoreMenu,
  conversationControls,
  callDisabledReason,
  videoCallDisabledReason,
  messageSearch,
  messageSearchInputRef,
  messageSearchButtonRef,
  moreButtonRef,
  messageSearchResults,
  messageSearchNormalizedQuery,
  isMessageSearchLoading,
  isMessageSearchError,
  isMessageSearchBelowMinimum,
  loadedMessageIds,
  editingMessageId,
  editText,
  isSavingEdit,
  messageInput,
  replyingTo,
  showEmojiPicker,
  isSending,
  isSendError,
  sendDisabledReason,
  composerResetToken,
  isOffline,
  isSessionExpired,
  isReconnecting,
  messagesContainerRef,
  messagesEndRef,
  emojiPickerRef,
  onOpenSidebar,
  onStartAudioCall,
  onStartVideoCall,
  onToggleConversationMoreMenu,
  onToggleMessageSearch,
  onMessageSearchChange,
  onClearMessageSearch,
  onSelectMessageSearchResult,
  onExportChat,
  onLoadMore,
  onRetryLoad,
  onScrollToBottom,
  onMessageContextMenu,
  onOpenMessageActions,
  onStartEdit,
  onRetryFailed,
  onDismissFailed,
  onEditTextChange,
  onSaveEdit,
  onCancelEdit,
  onComposerChange,
  onComposerKeyDown,
  onSendMessage,
  onToggleEmojiPicker,
  onAppendEmoji,
  onCancelReply,
}: ConversationPaneProps) => {
  const isMessageSearchActive = showMessageSearch && Boolean(messageSearch.trim());

  if (!selectedChat) {
    return (
      <ChatStateView
        heading="Select a conversation"
        body="Choose a chat from the sidebar or start a new one."
        className="bg-[var(--chat-bg)]"
      />
    );
  }

  if (isSessionExpired) {
    return (
      <ChatStateView
        heading="Your session expired"
        body="Sign in again to continue."
        tone="danger"
        className="bg-[var(--chat-bg)]"
        primaryAction={{
          label: 'Sign in',
          onClick: () => {
            window.location.assign('/login');
          },
        }}
      />
    );
  }

  return (
    <>
      <ConversationHeader
        selectedChat={selectedChat}
        title={getChatTitle(selectedChat, currentUserId)}
        otherMember={otherMember}
        otherMemberStatus={otherMemberStatus}
        showMessageSearch={showMessageSearch}
        showConversationMoreMenu={showConversationMoreMenu}
        callDisabledReason={callDisabledReason}
        videoCallDisabledReason={videoCallDisabledReason}
        searchButtonRef={messageSearchButtonRef}
        moreButtonRef={moreButtonRef}
        onOpenSidebar={onOpenSidebar}
        onStartAudioCall={onStartAudioCall}
        onStartVideoCall={onStartVideoCall}
        onToggleConversationMoreMenu={onToggleConversationMoreMenu}
        onToggleMessageSearch={onToggleMessageSearch}
        onExportChat={onExportChat}
      />

      {showMessageSearch && (
        <div className="border-b border-[var(--chat-border)] bg-[var(--chat-panel)] px-4 py-2 md:px-8">
          <input
            ref={messageSearchInputRef}
            type="text"
            name="message-search"
            value={messageSearch}
            onChange={(event) => onMessageSearchChange(event.target.value)}
            placeholder="Search this conversation"
            aria-label="Search this conversation"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 py-2 text-sm text-[var(--chat-text)] placeholder:text-[var(--chat-text-soft)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          />
        </div>
      )}

      {(isOffline || isReconnecting) && (
        <div
          className={`border-b border-[var(--chat-border)] px-4 py-2 text-sm ${
            isOffline ? 'bg-[color-mix(in_srgb,var(--chat-danger)_12%,var(--chat-panel))] text-[var(--chat-danger)]' : 'bg-[color-mix(in_srgb,var(--chat-warning)_14%,var(--chat-panel))] text-[var(--chat-warning)]'
          }`}
          aria-live="polite"
        >
          {isOffline
            ? 'You are offline. Reconnect to send new messages.'
            : 'Reconnecting. Messages will update when the connection returns.'}
        </div>
      )}

      {selectedChatId && <TypingIndicator chatId={selectedChatId} />}

      {isMessageSearchActive ? (
        <MessageSearchResults
          query={messageSearchNormalizedQuery || messageSearch}
          selectedChat={selectedChat}
          currentUserId={currentUserId}
          messages={messageSearchResults}
          loadedMessageIds={loadedMessageIds}
          isLoading={isMessageSearchLoading}
          isError={isMessageSearchError}
          isBelowMinimum={isMessageSearchBelowMinimum}
          onClear={onClearMessageSearch}
          onSelectLoadedResult={onSelectMessageSearchResult}
        />
      ) : (
        <MessageList
          selectedChat={selectedChat}
          messages={messages}
          currentUserId={currentUserId}
          isLoading={isMessagesLoading}
          isError={messagesError}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          highlightedMessageId={highlightedMessageId}
          isSearchActive={false}
          showScrollButton={showScrollButton}
          editingMessageId={editingMessageId}
          editText={editText}
          isSavingEdit={isSavingEdit}
          messagesContainerRef={messagesContainerRef}
          messagesEndRef={messagesEndRef}
          onLoadMore={onLoadMore}
          onRetryLoad={onRetryLoad}
          onScrollToBottom={onScrollToBottom}
          onMessageContextMenu={onMessageContextMenu}
          onOpenMessageActions={onOpenMessageActions}
          onStartEdit={onStartEdit}
          onRetryFailed={onRetryFailed}
          onDismissFailed={onDismissFailed}
          onEditTextChange={onEditTextChange}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
        />
      )}

      <MessageComposer
        value={messageInput}
        replyingTo={replyingTo}
        showEmojiPicker={showEmojiPicker}
        isSending={isSending}
        isSendError={isSendError}
        resetToken={composerResetToken}
        sendDisabledReason={
          isOffline
            ? 'You are offline. Reconnect to send new messages.'
            : isSessionExpired
              ? 'Your session expired. Sign in again to continue.'
              : conversationControls?.canSendMessage === false
                ? sendDisabledReason ?? 'Conversation activity is disabled.'
                : sendDisabledReason ?? null
        }
        emojiPickerRef={emojiPickerRef}
        onChange={onComposerChange}
        onKeyDown={onComposerKeyDown}
        onSend={onSendMessage}
        onToggleEmojiPicker={onToggleEmojiPicker}
        onAppendEmoji={onAppendEmoji}
        onCancelReply={onCancelReply}
      />
    </>
  );
};

export default ConversationPane;
