import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { ConversationDetailContentProps } from './ConversationDetailContent';
import ConversationDetailContent from './ConversationDetailContent';

interface ChatContextRailProps extends ConversationDetailContentProps {
  isOpen: boolean;
  onClose: () => void;
}

const RAIL_TRANSITION_MS = 220;

const ChatContextRail = ({ isOpen, onClose, ...contentProps }: ChatContextRailProps) => {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const animationFrame = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });

      return () => {
        window.cancelAnimationFrame(animationFrame);
      };
    }

    setIsVisible(false);
    const timeout = window.setTimeout(() => {
      setShouldRender(false);
    }, RAIL_TRANSITION_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isOpen]);

  if (!shouldRender) {
    return null;
  }

  return (
    <aside
      data-testid="chat-context-rail"
      className={`chat-context-rail hidden min-h-0 min-w-0 flex-col overflow-hidden border-l border-[var(--chat-border)] bg-[var(--chat-panel)] text-[var(--chat-text)] transition-all duration-200 ease-out xl:flex ${
        isVisible ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-6 opacity-0'
      }`}
      aria-label="Conversation details"
      aria-hidden={!isOpen}
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
