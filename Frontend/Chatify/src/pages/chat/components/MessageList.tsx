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
  onStartEdit: (messageId: string, currentText: string) => void;
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
  onStartEdit,
  onEditTextChange,
  onSaveEdit,
  onCancelEdit,
}: MessageListProps) => {
  return (
    <div
      ref={messagesContainerRef}
      className="relative flex-1 overflow-y-auto bg-slate-950 px-6 py-4 space-y-3 chat-messages-scroll"
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
                className="cursor-pointer text-xs text-emerald-400 hover:text-emerald-300 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
                      {formatMessageDate(message.createdAt)}
                    </div>
                  </div>
                )}
                {isEditing ? (
                  <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[70%] space-y-2">
                      <textarea
                        value={editText}
                        onChange={(event) => onEditTextChange(event.target.value)}
                        className="w-full rounded-lg border border-emerald-500 bg-slate-800 p-2 text-sm text-slate-100 focus:outline-none"
                        rows={3}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={onCancelEdit}
                          className="cursor-pointer px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={onSaveEdit}
                          disabled={isSavingEdit}
                          className="cursor-pointer rounded bg-emerald-500 px-3 py-1 text-xs text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed"
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
                    onDoubleClick={(msg) => onStartEdit(msg._id, msg.text)}
                  />
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </>
      ) : (
        <ChatStateView heading="No messages yet" body="Start the conversation!" />
      )}

      {showScrollButton && (
        <button
          type="button"
          onClick={onScrollToBottom}
          className="absolute bottom-6 right-8 z-40 rounded-full bg-emerald-500 p-3 text-emerald-950 shadow-lg transition-all hover:bg-emerald-400"
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
