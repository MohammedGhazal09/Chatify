import { AlertCircle, FileText, Image as ImageIcon, Mic, X } from 'lucide-react';
import type { MessageUploadState } from '../../../hooks/useChatQueries';
import type { ComposerAttachmentDraft } from '../../../types/chat';
import { formatDurationSeconds, formatFileSize } from '../utils/attachmentDisplay';

interface AttachmentTrayProps {
  attachments: ComposerAttachmentDraft[];
  errors: string[];
  disabled?: boolean;
  uploadState?: MessageUploadState;
  onCancelUpload?: () => void;
  onRemove: (id: string) => void;
}

const AttachmentTray = ({
  attachments,
  errors,
  disabled = false,
  uploadState,
  onCancelUpload,
  onRemove,
}: AttachmentTrayProps) => {
  if (!attachments.length && !errors.length) {
    return null;
  }

  const isUploading = uploadState?.status === 'uploading';

  return (
    <div className="mx-auto mb-3 max-w-[880px] space-y-2" data-testid="attachment-tray">
      {attachments.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex min-w-0 items-center gap-3 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] px-3 py-2"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[var(--chat-radius-md)] bg-[var(--chat-panel-subtle)] text-[var(--chat-accent)]">
                {attachment.localPreviewUrl ? (
                  <img
                    src={attachment.localPreviewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : attachment.kind === 'voice' ? (
                  <Mic aria-hidden="true" className="h-5 w-5" />
                ) : attachment.kind === 'media' ? (
                  <ImageIcon aria-hidden="true" className="h-5 w-5" />
                ) : (
                  <FileText aria-hidden="true" className="h-5 w-5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[var(--chat-text)]">{attachment.displayName}</span>
                <span className="block truncate text-xs text-[var(--chat-text-muted)]">
                  {attachment.kind === 'voice'
                    ? `Voice - ${formatDurationSeconds(attachment.durationSeconds)} - ${formatFileSize(attachment.size)}`
                    : `${attachment.mimeType || 'application/octet-stream'} - ${formatFileSize(attachment.size)}`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onRemove(attachment.id)}
                disabled={disabled || isUploading}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-danger)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                aria-label={`Remove ${attachment.displayName}`}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {isUploading && (
        <div className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] px-3 py-2">
          <div className="flex items-center justify-between gap-3 text-xs text-[var(--chat-text-muted)]">
            <span>Uploading {uploadState.progress}%</span>
            {onCancelUpload && (
              <button
                type="button"
                onClick={onCancelUpload}
                className="min-h-8 rounded-[var(--chat-radius-md)] px-2 font-semibold text-[var(--chat-danger)] hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
              >
                Cancel upload
              </button>
            )}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--chat-panel-subtle)]">
            <div
              className="h-full rounded-full bg-[var(--chat-accent)] transition-[width]"
              style={{ width: `${uploadState.progress}%` }}
            />
          </div>
        </div>
      )}
      {errors.length > 0 && (
        <div className="space-y-1 rounded-[var(--chat-radius-md)] border border-[color-mix(in_srgb,var(--chat-danger)_45%,var(--chat-border))] bg-[color-mix(in_srgb,var(--chat-danger)_8%,var(--chat-panel))] px-3 py-2 text-sm text-[var(--chat-danger)]">
          {errors.map((error) => (
            <p key={error} className="flex gap-2">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export default AttachmentTray;
