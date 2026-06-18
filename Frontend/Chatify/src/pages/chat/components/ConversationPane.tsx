import type { ChangeEvent, KeyboardEventHandler, RefObject } from 'react';
import { Ban, ShieldCheck, X } from 'lucide-react';
import type { MessageUploadState } from '../../../hooks/useChatQueries';
import type { Chat, ComposerSendPayload, ConversationControls, Message, UserOnlineStatus } from '../../../types/chat';
import type { User } from '../../../types/auth';
import TypingIndicator from '../../../components/TypingIndicator';
import { getChatTitle } from '../utils/chatDisplay';
import type { AttachmentPreviewTarget } from './AttachmentPreviewModal';
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
  isPresenceChecking?: boolean;
  messages: Message[];
  isMessagesLoading: boolean;
  messagesError: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  highlightedMessageId: string | null;
  showScrollButton: boolean;
  showMessageSearch: boolean;
  showConversationMoreMenu: boolean;
  showConversationDetails: boolean;
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
  composerUploadState?: MessageUploadState;
  isConversationControlPending: boolean;
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
  onToggleConversationDetails: () => void;
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
  onOpenAttachmentPreview: (attachment: AttachmentPreviewTarget) => void;
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
  onUnblockUser: () => void;
  onCancelReply: () => void;
  onCancelComposerUpload?: () => void;
}

type MessageListProps = Parameters<typeof MessageList>[0];

const ConversationPane = ({
  selectedChat,
  selectedChatId,
  currentUserId,
  otherMember,
  otherMemberStatus,
  isPresenceChecking = false,
  messages,
  isMessagesLoading,
  messagesError,
  hasMore,
  isLoadingMore,
  highlightedMessageId,
  showScrollButton,
  showMessageSearch,
  showConversationMoreMenu,
  showConversationDetails,
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
  composerUploadState,
  isConversationControlPending,
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
  onToggleConversationDetails,
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
  onOpenAttachmentPreview,
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
  onUnblockUser,
  onCancelReply,
  onCancelComposerUpload,
}: ConversationPaneProps) => {
  const isMessageSearchActive = showMessageSearch && Boolean(messageSearch.trim());
  const isConversationBlocked = conversationControls?.canSendMessage === false;

  if (!selectedChat) {
    return (
      <ChatStateView
        heading="Select a conversation"
        body="Open conversations and choose a chat, or start a new one from the sidebar."
        className="bg-[var(--chat-bg)]"
        primaryAction={{
          label: 'Open conversations',
          onClick: onOpenSidebar,
        }}
      />
    );
  }

  if (isSessionExpired) {
    return (
      <ChatStateView
        heading="Your session expired"
        body="Your private chat is hidden. Sign in again to continue."
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
        isPresenceChecking={isPresenceChecking}
        showMessageSearch={showMessageSearch}
        showConversationMoreMenu={showConversationMoreMenu}
        showConversationDetails={showConversationDetails}
        callDisabledReason={callDisabledReason}
        videoCallDisabledReason={videoCallDisabledReason}
        searchButtonRef={messageSearchButtonRef}
        moreButtonRef={moreButtonRef}
        onOpenSidebar={onOpenSidebar}
        onStartAudioCall={onStartAudioCall}
        onStartVideoCall={onStartVideoCall}
        onToggleConversationMoreMenu={onToggleConversationMoreMenu}
        onToggleConversationDetails={onToggleConversationDetails}
        onToggleMessageSearch={onToggleMessageSearch}
        onExportChat={onExportChat}
      />

      {showMessageSearch && (
        <div className="border-b border-[var(--chat-border)] bg-[var(--chat-panel)] px-4 py-2 md:px-8">
          <div className="relative">
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
              className="w-full rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] py-2 pl-3 pr-10 text-sm text-[var(--chat-text)] placeholder:text-[var(--chat-text-soft)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            />
            <button
              type="button"
              aria-label="Close message search"
              title="Close search"
              onClick={onToggleMessageSearch}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-[var(--chat-radius-sm)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {(isOffline || isReconnecting) && (
        <div
          className={`border-b border-[var(--chat-border)] px-4 py-2 text-sm ${
            isOffline ? 'bg-[color-mix(in_srgb,var(--chat-danger)_12%,var(--chat-panel))] text-[var(--chat-danger)]' : 'bg-[color-mix(in_srgb,var(--chat-warning)_14%,var(--chat-panel))] text-[var(--chat-warning)]'
          }`}
          role="status"
          aria-live="polite"
        >
          {isOffline
            ? 'You are offline. New messages will wait until the connection returns.'
            : 'Reconnecting. The timeline will refresh when the connection returns.'}
        </div>
      )}

      <ConversationBlockNotice
        conversationControls={conversationControls}
        otherMember={otherMember}
        isActionPending={isConversationControlPending}
        onUnblockUser={onUnblockUser}
      />

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
          onOpenAttachmentPreview={onOpenAttachmentPreview}
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
        uploadState={composerUploadState}
        resetToken={composerResetToken}
        sendDisabledReason={
          isOffline
            ? 'You are offline. New messages will wait until the connection returns.'
            : isSessionExpired
              ? 'Your session expired. Sign in again to continue.'
              : conversationControls?.canSendMessage === false
                ? sendDisabledReason ?? 'Conversation activity is disabled.'
                : sendDisabledReason ?? null
        }
        emojiPickerRef={emojiPickerRef}
        showDisabledReason={!isConversationBlocked}
        onChange={onComposerChange}
        onKeyDown={onComposerKeyDown}
        onSend={onSendMessage}
        onToggleEmojiPicker={onToggleEmojiPicker}
        onAppendEmoji={onAppendEmoji}
        onCancelReply={onCancelReply}
        onCancelUpload={onCancelComposerUpload}
      />
    </>
  );
};

const getMemberDisplayName = (member: User | null) => {
  if (!member) {
    return 'this user';
  }

  return `${member.firstName} ${member.lastName ?? ''}`.trim() || member.email || 'this user';
};

const ConversationBlockNotice = ({
  conversationControls,
  otherMember,
  isActionPending,
  onUnblockUser,
}: {
  conversationControls?: ConversationControls;
  otherMember: User | null;
  isActionPending: boolean;
  onUnblockUser: () => void;
}) => {
  if (!conversationControls || conversationControls.canSendMessage) {
    return null;
  }

  const participantName = getMemberDisplayName(otherMember);
  const blockedByMe = conversationControls.blockedByMe || conversationControls.messagingDisabledReason === 'blocked_by_me';
  const title = blockedByMe
    ? `You blocked ${participantName}`
    : `${participantName} is unavailable`;
  const body = blockedByMe
    ? 'New messages, calls, reactions, pins, and edits stay paused until you unblock them.'
    : 'This conversation is paused because the other person has blocked new activity.';

  return (
    <div className="px-4 pt-3 md:px-8">
      <div
        role="alert"
        aria-live="polite"
        className="mx-auto flex max-w-[880px] flex-col gap-3 rounded-[var(--chat-radius-lg)] border border-[color-mix(in_srgb,var(--chat-warning)_42%,var(--chat-border))] bg-[color-mix(in_srgb,var(--chat-warning)_14%,var(--chat-panel))] p-4 text-[var(--chat-text)] shadow-[0_18px_48px_rgba(0,0,0,0.18)] sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[color-mix(in_srgb,var(--chat-warning)_22%,var(--chat-panel))] text-[var(--chat-warning)]">
            {blockedByMe ? <Ban aria-hidden="true" className="h-5 w-5" /> : <ShieldCheck aria-hidden="true" className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--chat-text)]">{title}</p>
            <p className="mt-1 text-sm leading-5 text-[var(--chat-text-muted)]">{body}</p>
          </div>
        </div>
        {blockedByMe && (
          <button
            type="button"
            onClick={onUnblockUser}
            disabled={isActionPending}
            className="min-h-10 shrink-0 cursor-pointer rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-4 py-2 text-sm font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] disabled:cursor-not-allowed disabled:bg-[var(--chat-panel-subtle)] disabled:text-[var(--chat-text-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          >
            {isActionPending ? 'Unblocking...' : 'Unblock user'}
          </button>
        )}
      </div>
    </div>
  );
};

export default ConversationPane;
