import { useMemo } from 'react';
import { usePresenceStore } from '../store/presenceStore';
import { useAuthStore } from '../store/authstore';

interface TypingIndicatorProps {
  chatId: string;
}

// Animation delays for typing dots
const TYPING_DOT_DELAYS = [0, 150, 300];

export const TypingIndicator = ({ chatId }: TypingIndicatorProps) => {
  const { user } = useAuthStore();
  const typingUsersMap = usePresenceStore((state) => state.typingUsers);
  
  // Derive typing users for this chat from the map
  const typingUsers = useMemo(() => {
    const chatTyping = typingUsersMap.get(chatId);
    if (!chatTyping) return [];
    return Array.from(chatTyping.values());
  }, [typingUsersMap, chatId]);

  // Filter out current user from typing list
  const otherTypingUsers = typingUsers.filter((t) => t.userId !== user?._id);

  if (otherTypingUsers.length === 0) {
    return null;
  }

  const getTypingText = () => {
    if (otherTypingUsers.length === 1) {
      return `${otherTypingUsers[0].userName} is typing`;
    }
    if (otherTypingUsers.length === 2) {
      return `${otherTypingUsers[0].userName} and ${otherTypingUsers[1].userName} are typing`;
    }
    return `${otherTypingUsers.length} people are typing`;
  };

  return (
    <div className="typing-indicator flex items-center px-5 py-2 animate-fade-in md:px-8" aria-live="polite">
      <span className="inline-flex min-h-10 items-center gap-2 rounded-[var(--chat-radius-lg)] border border-[var(--chat-border)] bg-[var(--chat-received-bubble)] px-4 text-sm text-[var(--chat-text-muted)] shadow-sm">
        <span>{getTypingText()}</span>
        <span className="typing-dots flex gap-1">
        {TYPING_DOT_DELAYS.map((delay, index) => (
          <span
            key={index}
              className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--chat-accent)]"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
        </span>
      </span>
    </div>
  );
};

// Compact version for inline display
export const TypingIndicatorCompact = ({ chatId }: TypingIndicatorProps) => {
  const { user } = useAuthStore();
  const typingUsersMap = usePresenceStore((state) => state.typingUsers);
  
  // Derive typing users for this chat from the map
  const typingUsers = useMemo(() => {
    const chatTyping = typingUsersMap.get(chatId);
    if (!chatTyping) return [];
    return Array.from(chatTyping.values());
  }, [typingUsersMap, chatId]);

  const otherTypingUsers = typingUsers.filter((t) => t.userId !== user?._id);

  if (otherTypingUsers.length === 0) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-[var(--chat-text-muted)] italic" aria-live="polite">
      <span className="typing-dots flex gap-0.5">
        {TYPING_DOT_DELAYS.map((delay, index) => (
          <span
            key={index}
            className="w-1 h-1 bg-[var(--chat-accent)] rounded-full animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
    </span>
  );
};

export default TypingIndicator;
