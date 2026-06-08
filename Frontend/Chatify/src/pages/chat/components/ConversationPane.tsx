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
  onStartEdit: (messageId: string, currentText: string) => void;
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
  onStartEdit,
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
        body="Choose a chat from the sidebar to read messages and start talking."
        className="bg-slate-950"
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
        <div className="border-b border-slate-800 bg-slate-900/60 px-4 py-2">
          <input
            type="text"
            value={messageSearch}
            onChange={(event) => onMessageSearchChange(event.target.value)}
            placeholder="Search in conversation..."
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          {messageSearch && (
            <p className="mt-1 text-xs text-slate-500">
              Found {messages.length} message{messages.length !== 1 ? 's' : ''}
            </p>
          )}
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
        onStartEdit={onStartEdit}
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
