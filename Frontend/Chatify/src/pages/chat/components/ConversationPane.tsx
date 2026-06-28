import type { ChangeEvent, KeyboardEventHandler, RefObject } from 'react';
import { Ban, Lock, ShieldCheck, X } from 'lucide-react';
import type { MessageUploadState } from '../../../hooks/useChatQueries';
import type {
  Chat,
  ComposerSendPayload,
  ConversationControls,
  Message,
  MessageSearchFilters,
  MessageSearchType,
  UserOnlineStatus,
} from '../../../types/chat';
import type { User } from '../../../types/auth';
import TypingIndicator from '../../../components/TypingIndicator';
import { getChatTitle } from '../utils/chatDisplay';
import type { AttachmentPreviewTarget } from './AttachmentPreviewModal';
import ChatStateView from './ChatStateView';
import ConversationHeader from './ConversationHeader';
import MessageComposer from './MessageComposer';
import MessageList from './MessageList';
import MessageSearchResults from './MessageSearchResults';
import { hasConversationSecret, isEncryptedConversation } from '../../../utils/encryptedMessages';

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
  messageSearchFilters: MessageSearchFilters;
  messageSearchInputRef: RefObject<HTMLInputElement | null>;
  messageSearchButtonRef: RefObject<HTMLButtonElement | null>;
  moreButtonRef?: RefObject<HTMLButtonElement | null>;
  messageSearchResults: Message[];
  messageSearchNormalizedQuery: string;
  isMessageSearchLoading: boolean;
  isMessageSearchError: boolean;
  isMessageSearchBelowMinimum: boolean;
  jumpingMessageId?: string | null;
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
  hasConversations?: boolean;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  emojiPickerRef: RefObject<HTMLDivElement | null>;
  onOpenSidebar: () => void;
  onOpenContacts?: () => void;
  onStartAudioCall: () => void;
  onStartVideoCall: () => void;
  onToggleConversationMoreMenu: () => void;
  onToggleConversationDetails: () => void;
  onToggleMessageSearch: () => void;
  onMessageSearchChange: (value: string) => void;
  onMessageSearchFiltersChange: (patch: Partial<MessageSearchFilters>) => void;
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

const MESSAGE_SEARCH_TYPES: Array<{ value: MessageSearchType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'text', label: 'Text' },
  { value: 'link', label: 'Links' },
  { value: 'media', label: 'Media' },
  { value: 'file', label: 'Files' },
  { value: 'voice', label: 'Voice' },
];

const getMemberLabel = (member: User, currentUserId?: string) => {
  if (member._id === currentUserId) {
    return 'You';
  }

  return `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim() || member.username || 'Unknown member';
};

const hasActiveSearchFilters = (filters: MessageSearchFilters) => Boolean(
  filters.senderId ||
  (filters.type && filters.type !== 'all') ||
  filters.from ||
  filters.to
);

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
  messageSearchFilters,
  messageSearchInputRef,
  messageSearchButtonRef,
  moreButtonRef,
  messageSearchResults,
  messageSearchNormalizedQuery,
  isMessageSearchLoading,
  isMessageSearchError,
  isMessageSearchBelowMinimum,
  jumpingMessageId = null,
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
  hasConversations = false,
  messagesContainerRef,
  messagesEndRef,
  emojiPickerRef,
  onOpenSidebar,
  onOpenContacts,
  onStartAudioCall,
  onStartVideoCall,
  onToggleConversationMoreMenu,
  onToggleConversationDetails,
  onToggleMessageSearch,
  onMessageSearchChange,
  onMessageSearchFiltersChange,
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
  const isMessageSearchActive = showMessageSearch && (
    Boolean(messageSearch.trim()) ||
    hasActiveSearchFilters(messageSearchFilters)
  );
  const isConversationBlocked = conversationControls?.canSendMessage === false;
  const encryptedConversation = isEncryptedConversation(selectedChat);
  const missingEncryptionSecret = encryptedConversation && !hasConversationSecret(selectedChat?._id);

  if (!selectedChat) {
    const openContacts = onOpenContacts ?? onOpenSidebar;

    return (
      <ChatStateView
        heading={hasConversations ? 'Select a conversation' : 'No conversations yet'}
        body={hasConversations
          ? 'Pick a contact to open a conversation, or start a new one.'
          : 'You have no contacts or messages yet. Start a new conversation to get going.'}
        className="bg-[var(--chat-bg)]"
        primaryAction={{
          label: hasConversations ? 'Open conversation' : 'Start a new conversation',
          onClick: openContacts,
        }}
        secondaryAction={hasConversations
          ? { label: 'Open conversations', onClick: onOpenSidebar }
          : undefined}
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

      {showMessageSearch && encryptedConversation ? (
        <div className="border-b border-[var(--chat-border)] bg-[var(--chat-panel)] px-4 py-3 md:px-8">
          <div className="flex items-start justify-between gap-3 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] px-3 py-3 text-sm text-[var(--chat-text-muted)]" role="status">
            <div className="flex min-w-0 gap-2">
              <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--chat-accent)]" />
              <p>
                Server-side search is unavailable for encrypted conversations. Search can return after local encrypted indexing is supported.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close message search"
              title="Close search"
              onClick={onToggleMessageSearch}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--chat-radius-sm)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel)] hover:text-[var(--chat-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : showMessageSearch ? (
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
          <div className="mt-2 grid gap-2 text-xs text-[var(--chat-text-muted)] xl:grid-cols-[minmax(10rem,14rem)_1fr_minmax(8rem,10rem)_minmax(8rem,10rem)]">
            <label className="flex min-w-0 flex-col gap-1 font-semibold">
              <span>Sender</span>
              <select
                value={messageSearchFilters.senderId ?? ''}
                onChange={(event) => onMessageSearchFiltersChange({ senderId: event.target.value || null })}
                className="h-9 rounded-[var(--chat-radius-sm)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-2 text-sm font-medium text-[var(--chat-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                aria-label="Search sender filter"
              >
                <option value="">Anyone</option>
                {selectedChat.members.map((member) => (
                  <option key={member._id} value={member._id}>
                    {getMemberLabel(member, currentUserId)}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="min-w-0">
              <legend className="mb-1 font-semibold">Type</legend>
              <div className="flex min-h-9 flex-wrap gap-1">
                {MESSAGE_SEARCH_TYPES.map((option) => {
                  const isActive = (messageSearchFilters.type ?? 'all') === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => onMessageSearchFiltersChange({ type: option.value })}
                      className={`min-h-8 rounded-[var(--chat-radius-sm)] border px-2 text-xs font-semibold transition ${
                        isActive
                          ? 'border-[var(--chat-accent)] bg-[var(--chat-accent-soft)] text-[var(--chat-accent)]'
                          : 'border-[var(--chat-border)] bg-[var(--chat-input-bg)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)]'
                      } focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className="flex min-w-0 flex-col gap-1 font-semibold">
              <span>From</span>
              <input
                type="date"
                value={messageSearchFilters.from ?? ''}
                onChange={(event) => onMessageSearchFiltersChange({ from: event.target.value || null })}
                className="h-9 rounded-[var(--chat-radius-sm)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-2 text-sm font-medium text-[var(--chat-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                aria-label="Search from date"
              />
            </label>

            <label className="flex min-w-0 flex-col gap-1 font-semibold">
              <span>To</span>
              <input
                type="date"
                value={messageSearchFilters.to ?? ''}
                onChange={(event) => onMessageSearchFiltersChange({ to: event.target.value || null })}
                className="h-9 rounded-[var(--chat-radius-sm)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-2 text-sm font-medium text-[var(--chat-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                aria-label="Search to date"
              />
            </label>
          </div>
        </div>
      ) : null}

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
          jumpingMessageId={jumpingMessageId}
          onClear={onClearMessageSearch}
          onSelectResult={onSelectMessageSearchResult}
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
                : missingEncryptionSecret
                  ? 'This device needs the conversation secret to send encrypted messages.'
                  : sendDisabledReason ?? null
        }
        isEncryptedConversation={encryptedConversation}
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

  return `${member.firstName} ${member.lastName ?? ''}`.trim() || member.username || 'this user';
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
