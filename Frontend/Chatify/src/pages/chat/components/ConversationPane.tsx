import type { ChangeEvent, KeyboardEventHandler, RefObject } from 'react';
import type { Chat, Message, UserOnlineStatus } from '../../../types/chat';
import type { User } from '../../../types/auth';
import TypingIndicator from '../../../components/TypingIndicator';
import { getChatTitle } from '../utils/chatDisplay';
import ChatStateView from './ChatStateView';
import ConversationHeader from './ConversationHeader';
import MessageComposer from './MessageComposer';
import MessageList from './MessageList';

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
  showScrollButton: boolean;
  showMessageSearch: boolean;
  messageSearch: string;
  editingMessageId: string | null;
  editText: string;
  isSavingEdit: boolean;
  messageInput: string;
  replyingTo: Message | null;
  showEmojiPicker: boolean;
  isSending: boolean;
  isSendError: boolean;
  isOffline: boolean;
  isSessionExpired: boolean;
  isReconnecting: boolean;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  emojiPickerRef: RefObject<HTMLDivElement | null>;
  onOpenSidebar: () => void;
  onToggleMessageSearch: () => void;
  onMessageSearchChange: (value: string) => void;
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
  onComposerKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  onSendMessage: () => void;
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
  showScrollButton,
  showMessageSearch,
  messageSearch,
  editingMessageId,
  editText,
  isSavingEdit,
  messageInput,
  replyingTo,
  showEmojiPicker,
  isSending,
  isSendError,
  isOffline,
  isSessionExpired,
  isReconnecting,
  messagesContainerRef,
  messagesEndRef,
  emojiPickerRef,
  onOpenSidebar,
  onToggleMessageSearch,
  onMessageSearchChange,
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
  if (!selectedChat) {
    return (
      <ChatStateView
        heading="Select a conversation"
        body="Choose a chat from the sidebar or start a new one."
        className="bg-[#101113]"
      />
    );
  }

  if (isSessionExpired) {
    return (
      <ChatStateView
        heading="Your session expired"
        body="Sign in again to continue."
        tone="danger"
        className="bg-[#101113]"
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
        onOpenSidebar={onOpenSidebar}
        onToggleMessageSearch={onToggleMessageSearch}
        onExportChat={onExportChat}
      />

      {showMessageSearch && (
        <div className="border-b border-[#2E363C] bg-[#181C20] px-4 py-2">
          <input
            type="text"
            value={messageSearch}
            onChange={(event) => onMessageSearchChange(event.target.value)}
            placeholder="Search in conversation..."
            aria-label="Search messages in this conversation"
            className="w-full rounded-lg border border-[#2E363C] bg-[#20262B] px-3 py-2 text-sm text-[#F4F7F6] placeholder:text-[#6F7B77] focus:outline-none focus:ring-1 focus:ring-[#14B8A6]"
          />
          {messageSearch && (
            <p className="mt-1 text-xs text-[#6F7B77]" aria-live="polite">
              Found {messages.length} message{messages.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {(isOffline || isReconnecting) && (
        <div
          className={`border-b border-[#2E363C] px-4 py-2 text-sm ${
            isOffline ? 'bg-[#2B2020] text-[#EF4444]' : 'bg-[#2B281B] text-[#F59E0B]'
          }`}
          aria-live="polite"
        >
          {isOffline
            ? 'You are offline. Reconnect to send new messages.'
            : 'Reconnecting. Messages will update when the connection returns.'}
        </div>
      )}

      {selectedChatId && <TypingIndicator chatId={selectedChatId} />}

      <MessageList
        selectedChat={selectedChat}
        messages={messages}
        currentUserId={currentUserId}
        isLoading={isMessagesLoading}
        isError={messagesError}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        isSearchActive={Boolean(messageSearch.trim())}
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

      <MessageComposer
        value={messageInput}
        replyingTo={replyingTo}
        showEmojiPicker={showEmojiPicker}
        isSending={isSending}
        isSendError={isSendError}
        sendDisabledReason={
          isOffline
            ? 'You are offline. Reconnect to send new messages.'
            : isSessionExpired
              ? 'Your session expired. Sign in again to continue.'
              : null
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
