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
  const toneClass = tone === 'danger' ? 'text-[#EF4444]' : 'text-[#A8B3AF]';

  return (
    <div className={`flex h-full flex-col items-center justify-center gap-3 px-6 text-center ${toneClass} ${className}`} aria-live="polite">
      {icon ? <div className="text-2xl" aria-hidden="true">{icon}</div> : null}
      <h2 className="text-lg font-bold leading-tight text-[#F4F7F6]">{heading}</h2>
      <p className="max-w-[420px] text-sm leading-5">{body}</p>
      {(primaryAction || secondaryAction) && (
        <div className="mt-2 flex items-center gap-2">
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="min-h-10 cursor-pointer rounded-lg border border-[#2E363C] bg-[#20262B] px-3 py-1.5 text-sm font-semibold text-[#A8B3AF] hover:bg-[#181C20] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
            >
              {secondaryAction.label}
            </button>
          )}
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="min-h-10 cursor-pointer rounded-lg bg-[#14B8A6] px-3 py-1.5 text-sm font-semibold text-[#101113] hover:bg-[#22C55E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
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
