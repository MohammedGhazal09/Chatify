import type { ConversationDetailContentProps } from './ConversationDetailContent';
import ConversationDetailContent from './ConversationDetailContent';

const ChatContextRail = (props: ConversationDetailContentProps) => {
  return (
    <aside
      data-testid="chat-context-rail"
      className="hidden min-h-0 flex-col overflow-y-auto border-l border-[var(--chat-border)] bg-[var(--chat-panel)] px-6 py-5 text-[var(--chat-text)] xl:flex"
      aria-label="Conversation details"
    >
      <ConversationDetailContent {...props} />
    </aside>
  );
};

export default ChatContextRail;
