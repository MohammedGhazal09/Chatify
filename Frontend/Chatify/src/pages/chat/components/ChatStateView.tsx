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
  const liveRole = tone === 'danger' ? 'alert' : 'status';
  const liveMode = tone === 'danger' ? 'assertive' : 'polite';

  return (
    <div
      className={`flex h-full min-w-0 flex-col items-center justify-center gap-3 px-6 text-center ${toneClass} ${className}`}
      role={liveRole}
      aria-live={liveMode}
    >
      {icon ? <div className="text-2xl" aria-hidden="true">{icon}</div> : null}
      <h2 className="text-lg font-bold leading-tight text-[var(--chat-text)]">{heading}</h2>
      <p className="max-w-[420px] text-sm leading-5">{body}</p>
      {(primaryAction || secondaryAction) && (
        <div className="mt-2 flex w-full max-w-[420px] flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-center">
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="min-h-10 cursor-pointer rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] sm:w-auto"
            >
              {secondaryAction.label}
            </button>
          )}
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="min-h-10 cursor-pointer rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-3 py-1.5 text-sm font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] sm:w-auto"
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
