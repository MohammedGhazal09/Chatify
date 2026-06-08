import type { RefObject } from 'react';
import type { MouseEvent } from 'react';
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
      className="relative flex-1 overflow-y-auto bg-[#101113] px-4 py-4 space-y-3 chat-messages-scroll md:px-6"
    >
      {isLoading ? (
        <ChatStateView heading="Loading messages" body="Loading messages..." />
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
                className="min-h-8 cursor-pointer rounded-lg border border-[#2E363C] bg-[#20262B] px-3 py-1 text-xs font-semibold text-[#14B8A6] hover:bg-[#181C20] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoadingMore ? 'Loading...' : 'Load older messages'}
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
                  <div className="my-4 flex items-center justify-center">
                    <div className="rounded-full border border-[#2E363C] bg-[#20262B] px-3 py-1 text-xs text-[#A8B3AF]">
                      {formatMessageDate(message.createdAt)}
                    </div>
                  </div>
                )}
                {isEditing ? (
                  <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[85%] space-y-2 md:max-w-[75%] xl:max-w-[68%]">
                      <textarea
                        value={editText}
                        onChange={(event) => onEditTextChange(event.target.value)}
                        className="w-full rounded-lg border border-[#14B8A6] bg-[#20262B] p-2 text-sm text-[#F4F7F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
                        rows={3}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={onCancelEdit}
                          className="min-h-8 cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold text-[#A8B3AF] hover:bg-[#20262B] hover:text-[#F4F7F6]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={onSaveEdit}
                          disabled={isSavingEdit}
                          className="min-h-8 cursor-pointer rounded-lg bg-[#14B8A6] px-3 py-1 text-xs font-semibold text-[#101113] hover:bg-[#22C55E] disabled:cursor-not-allowed"
                        >
                          {isSavingEdit ? 'Saving...' : 'Save'}
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
          className="absolute bottom-6 right-6 z-40 min-h-10 min-w-10 rounded-full bg-[#14B8A6] p-3 text-[#101113] shadow-lg transition-all hover:bg-[#22C55E]"
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          <span aria-hidden="true">Down</span>
        </button>
      )}
    </div>
  );
};

export default MessageList;
