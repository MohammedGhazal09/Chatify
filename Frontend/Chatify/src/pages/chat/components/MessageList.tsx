import type { RefObject } from 'react';
import type { MouseEvent } from 'react';
import { ArrowDown, LoaderCircle } from 'lucide-react';
import type { Chat, Message } from '../../../types/chat';
import { formatMessageDate, isDifferentDay } from '../utils/chatDisplay';
import ChatStateView from './ChatStateView';
import MessageBubble from './MessageBubble';

interface MessageListProps {
  selectedChat: Chat;
  messages: Message[];
  currentUserId?: string;
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  highlightedMessageId: string | null;
  isSearchActive: boolean;
  showScrollButton: boolean;
  editingMessageId: string | null;
  editText: string;
  isSavingEdit: boolean;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onLoadMore: () => void;
  onRetryLoad: () => void;
  onScrollToBottom: () => void;
  onMessageContextMenu: (event: MouseEvent, messageId: string, isOwnMessage: boolean) => void;
  onOpenMessageActions: (event: MouseEvent<HTMLButtonElement>, message: Message, isOwnMessage: boolean) => void;
  onStartEdit: (messageId: string, currentText: string) => void;
  onRetryFailed: (message: Message) => void;
  onDismissFailed: (message: Message) => void;
  onEditTextChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}

const MessageList = ({
  selectedChat,
  messages,
  currentUserId,
  isLoading,
  isError,
  hasMore,
  isLoadingMore,
  highlightedMessageId,
  isSearchActive,
  showScrollButton,
  editingMessageId,
  editText,
  isSavingEdit,
  messagesContainerRef,
  messagesEndRef,
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
}: MessageListProps) => {
  return (
    <div
      ref={messagesContainerRef}
      className="relative flex-1 w-full max-w-full overflow-x-hidden overflow-y-auto bg-[var(--chat-bg)] px-5 py-5 space-y-4 chat-messages-scroll md:px-8 md:py-6"
    >
      {isLoading ? (
        <MessageListSkeleton />
      ) : isError ? (
        <ChatStateView
          heading="Conversation unavailable"
          body="We could not load this conversation."
          tone="danger"
          primaryAction={{ label: 'Try again', onClick: onRetryLoad }}
        />
      ) : messages.length > 0 ? (
        <>
          {hasMore && (
            <div className="flex justify-center py-2">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="min-h-8 cursor-pointer rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] px-3 py-1 text-xs font-semibold text-[var(--chat-accent)] hover:bg-[var(--chat-panel-subtle)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
              >
                {isLoadingMore ? (
                  <span className="inline-flex items-center gap-2">
                    <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 motion-safe:animate-spin" />
                    Loading…
                  </span>
                ) : (
                  'Load older messages'
                )}
              </button>
            </div>
          )}
          {messages.map((message, index) => {
            const isOwnMessage = message.sender === currentUserId;
            const prevMessage = messages[index - 1];
            const showDateSeparator = index === 0 || (prevMessage && isDifferentDay(prevMessage.createdAt, message.createdAt));
            const isEditing = editingMessageId === message._id;

            return (
              <div key={message._id}>
                {showDateSeparator && (
                  <div className="mx-auto my-5 flex w-full max-w-[760px] items-center gap-4">
                    <div className="h-px flex-1 bg-[var(--chat-border)]" />
                    <div className="rounded-full border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] px-4 py-1 text-xs font-medium text-[var(--chat-text-muted)]">
                      {formatMessageDate(message.createdAt)}
                    </div>
                    <div className="h-px flex-1 bg-[var(--chat-border)]" />
                  </div>
                )}
                {isEditing ? (
                  <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[85%] space-y-2 md:max-w-[75%] xl:max-w-[52%]">
                      <textarea
                        value={editText}
                        onChange={(event) => onEditTextChange(event.target.value)}
                        aria-label="Edit message"
                        className="w-full rounded-[var(--chat-radius-md)] border border-[var(--chat-focus)] bg-[var(--chat-input-bg)] p-2 text-sm text-[var(--chat-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                        rows={3}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={onCancelEdit}
                          className="min-h-8 cursor-pointer rounded-[var(--chat-radius-md)] px-3 py-1 text-xs font-semibold text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={onSaveEdit}
                          disabled={isSavingEdit}
                          className="min-h-8 cursor-pointer rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-3 py-1 text-xs font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] disabled:cursor-not-allowed"
                        >
                          {isSavingEdit ? (
                            <span className="inline-flex items-center gap-2">
                              <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 motion-safe:animate-spin" />
                              Saving…
                            </span>
                          ) : (
                            'Save'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <MessageBubble
                    message={message}
                    isOwnMessage={isOwnMessage}
                    isGroupChat={selectedChat.isGroupChat}
                    members={selectedChat.members}
                    isHighlighted={message._id === highlightedMessageId}
                    onContextMenu={(event) => onMessageContextMenu(event, message._id, isOwnMessage)}
                    onOpenActions={onOpenMessageActions}
                    onDoubleClick={(msg) => onStartEdit(msg._id, msg.text)}
                    onRetryFailed={onRetryFailed}
                    onDismissFailed={onDismissFailed}
                  />
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </>
      ) : (
        <ChatStateView
          heading={isSearchActive ? 'No matches found' : 'No messages yet'}
          body={isSearchActive ? 'Try a different name or message term.' : 'Send the first message when you are ready.'}
        />
      )}

      {showScrollButton && (
        <button
          type="button"
          onClick={onScrollToBottom}
          className="absolute bottom-6 right-6 z-40 min-h-10 min-w-10 rounded-full bg-[var(--chat-accent)] p-3 text-[var(--chat-own-text)] shadow-lg transition-colors hover:bg-[var(--chat-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          <ArrowDown aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

const MessageListSkeleton = () => (
  <div className="space-y-3" aria-label="Loading messages">
    <div className="mx-auto h-6 w-28 motion-safe:animate-pulse rounded-full border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)]" />
    {[0, 1, 2, 3, 4].map((item) => (
      <div key={item} className={`flex ${item % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
        <div
          className={`h-16 motion-safe:animate-pulse rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] ${
            item % 2 === 0 ? 'w-[68%] md:w-[52%]' : 'w-[74%] bg-[var(--chat-own-bubble)] md:w-[48%]'
          }`}
        />
      </div>
    ))}
  </div>
);

export default MessageList;
