import { X } from 'lucide-react';
import type { ConversationDetailContentProps } from './ConversationDetailContent';
import ConversationDetailContent from './ConversationDetailContent';

interface ChatContextRailProps extends ConversationDetailContentProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChatContextRail = ({ isOpen, onClose, ...contentProps }: ChatContextRailProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <aside
      data-testid="chat-context-rail"
      className="hidden min-h-0 flex-col overflow-hidden border-l border-[var(--chat-border)] bg-[var(--chat-panel)] text-[var(--chat-text)] xl:flex"
      aria-label="Conversation details"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose();
        }
      }}
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--chat-border)] px-6">
        <h2 className="text-base font-bold text-[var(--chat-text)]">Conversation details</h2>
        <button
          type="button"
          onClick={onClose}
          className="grid h-10 w-10 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          aria-label="Close conversation details"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <ConversationDetailContent {...contentProps} />
      </div>
    </aside>
  );
};

export default ChatContextRail;
