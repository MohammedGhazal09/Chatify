import { Mic, X } from 'lucide-react';
import type { UseVoiceRecorderResult } from '../../../hooks/useVoiceRecorder';
import { formatDurationSeconds } from '../utils/attachmentDisplay';

interface VoiceRecorderTrayProps {
  recorder: UseVoiceRecorderResult;
  disabled?: boolean;
}

const VoiceRecorderTray = ({ recorder, disabled = false }: VoiceRecorderTrayProps) => {
  const hasVisibleState = recorder.isRecording || recorder.errorMessage;

  if (!hasVisibleState) {
    return null;
  }

  const durationLabel = formatDurationSeconds(recorder.durationSeconds);

  return (
    <div className="mx-auto mb-3 max-w-[880px] rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] px-3 py-2" data-testid="voice-recorder-tray">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel-subtle)] text-[var(--chat-accent)]">
          <Mic aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--chat-text)]">
            {recorder.isRecording ? `Recording ${durationLabel}` : 'Voice message'}
          </p>
          <p className={`truncate text-xs ${recorder.errorMessage ? 'text-[var(--chat-danger)]' : 'text-[var(--chat-text-muted)]'}`}>
            {recorder.errorMessage
              ? recorder.errorMessage
              : 'Recording'}
          </p>
        </div>
        {recorder.isRecording ? (
          <button
            type="button"
            onClick={recorder.cancelRecording}
            disabled={disabled}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-danger)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label="Cancel voice recording"
            title="Cancel recording"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={recorder.clearDraft}
            disabled={disabled}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-danger)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label="Remove voice message"
            title="Dismiss voice status"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default VoiceRecorderTray;
