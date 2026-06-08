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
  const toneClass = tone === 'danger' ? 'text-red-400' : 'text-slate-400';

  return (
    <div className={`flex h-full flex-col items-center justify-center gap-3 px-6 text-center ${toneClass} ${className}`}>
      {icon ? <div className="text-2xl" aria-hidden="true">{icon}</div> : null}
      <h2 className="text-lg font-semibold text-slate-100">{heading}</h2>
      <p className="max-w-md text-sm">{body}</p>
      {(primaryAction || secondaryAction) && (
        <div className="mt-2 flex items-center gap-2">
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="cursor-pointer rounded bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-700"
            >
              {secondaryAction.label}
            </button>
          )}
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="cursor-pointer rounded bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
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
