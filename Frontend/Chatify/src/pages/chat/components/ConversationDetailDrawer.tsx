import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { ConversationDetailContentProps } from './ConversationDetailContent';
import ConversationDetailContent from './ConversationDetailContent';

interface ConversationDetailDrawerProps extends ConversationDetailContentProps {
  isOpen: boolean;
  onClose: () => void;
}

const ConversationDetailDrawer = ({ isOpen, onClose, ...contentProps }: ConversationDetailDrawerProps) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55 xl:hidden" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close details backdrop"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Conversation details"
        className="relative z-10 flex h-full w-full max-w-[420px] flex-col overflow-hidden border-l border-[var(--chat-border)] bg-[var(--chat-panel)] text-[var(--chat-text)] shadow-2xl"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--chat-border)] px-5">
          <h2 className="text-base font-bold">Conversation details</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label="Close conversation details"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <ConversationDetailContent {...contentProps} />
        </div>
      </section>
    </div>
  );
};

export default ConversationDetailDrawer;
