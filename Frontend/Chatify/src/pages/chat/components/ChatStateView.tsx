import type { ReactNode } from 'react';

interface ChatStateAction {
  label: string;
  onClick: () => void;
}

interface ChatStateViewProps {
  heading: string;
  body: string;
  tone?: 'default' | 'danger';
  icon?: ReactNode;
  primaryAction?: ChatStateAction;
  secondaryAction?: ChatStateAction;
  className?: string;
}

const ChatStateView = ({
  heading,
  body,
  tone = 'default',
  icon,
  primaryAction,
  secondaryAction,
  className = '',
}: ChatStateViewProps) => {
  const toneClass = tone === 'danger' ? 'text-[var(--chat-danger)]' : 'text-[var(--chat-text-muted)]';

  return (
    <div className={`flex h-full flex-col items-center justify-center gap-3 px-6 text-center ${toneClass} ${className}`} aria-live="polite">
      {icon ? <div className="text-2xl" aria-hidden="true">{icon}</div> : null}
      <h2 className="text-lg font-bold leading-tight text-[var(--chat-text)]">{heading}</h2>
      <p className="max-w-[420px] text-sm leading-5">{body}</p>
      {(primaryAction || secondaryAction) && (
        <div className="mt-2 flex items-center gap-2">
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="min-h-10 cursor-pointer rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            >
              {secondaryAction.label}
            </button>
          )}
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="min-h-10 cursor-pointer rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-3 py-1.5 text-sm font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            >
              {primaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatStateView;
