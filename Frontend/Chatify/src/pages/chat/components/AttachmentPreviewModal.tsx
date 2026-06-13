import { Download, FileText, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { messageApi } from '../../../api/messageApi';
import type { AttachmentStatus, SharedAssetKind } from '../../../types/chat';
import { formatFileSize } from '../utils/attachmentDisplay';

export interface AttachmentPreviewTarget {
  attachmentId: string;
  displayName: string;
  mimeType: string;
  size: number;
  kind: SharedAssetKind;
  status: AttachmentStatus;
  localPreviewUrl?: string;
}

interface AttachmentPreviewModalProps {
  attachment: AttachmentPreviewTarget | null;
  onClose: () => void;
}

const AttachmentPreviewModal = ({ attachment, onClose }: AttachmentPreviewModalProps) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previewUrl = useMemo(() => {
    if (!attachment || attachment.status !== 'active') {
      return null;
    }

    return attachment.localPreviewUrl ?? messageApi.getAttachmentPreviewUrl(attachment.attachmentId);
  }, [attachment]);
  const downloadUrl = attachment?.status === 'active'
    ? messageApi.getAttachmentDownloadUrl(attachment.attachmentId)
    : null;

  useEffect(() => {
    if (!attachment) {
      return undefined;
    }

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [attachment, onClose]);

  if (!attachment) {
    return null;
  }

  const isImage = attachment.kind === 'media' || attachment.mimeType.startsWith('image/');
  const isPdf = attachment.mimeType === 'application/pdf';
  const isProtectedRemotePreview = Boolean(previewUrl && !attachment.localPreviewUrl);

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${attachment.displayName}`}
    >
      <button
        type="button"
        aria-label="Close attachment preview backdrop"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section className="relative z-10 flex h-full max-h-[92vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-[var(--chat-radius-lg)] border border-[var(--chat-border)] bg-[var(--chat-panel)] text-[var(--chat-text)] shadow-[var(--chat-shadow)]">
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[var(--chat-border)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold">{attachment.displayName}</h2>
            <p className="text-xs text-[var(--chat-text-muted)]">
              {attachment.mimeType || 'File'} - {formatFileSize(attachment.size)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {downloadUrl && (
              <a
                href={downloadUrl}
                className="grid h-10 w-10 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                aria-label={`Download ${attachment.displayName}`}
              >
                <Download aria-hidden="true" className="h-5 w-5" />
              </a>
            )}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
              aria-label="Close attachment preview"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 bg-[var(--chat-bg)] p-3 md:p-4">
          {previewUrl && isImage ? (
            <img
              src={previewUrl}
              alt={attachment.displayName}
              crossOrigin={isProtectedRemotePreview ? 'use-credentials' : undefined}
              className="mx-auto h-full max-h-[calc(92vh-112px)] w-full object-contain"
            />
          ) : previewUrl && isPdf ? (
            <iframe
              src={previewUrl}
              title={attachment.displayName}
              className="h-full min-h-[70vh] w-full rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-white"
            />
          ) : (
            <div className="grid h-full min-h-[320px] place-items-center rounded-[var(--chat-radius-md)] border border-dashed border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] p-6 text-center">
              <div>
                <FileText aria-hidden="true" className="mx-auto h-12 w-12 text-[var(--chat-accent)]" />
                <p className="mt-3 text-sm font-semibold">Preview unavailable</p>
                <p className="mt-1 text-sm text-[var(--chat-text-muted)]">Download the file to open it locally.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AttachmentPreviewModal;
