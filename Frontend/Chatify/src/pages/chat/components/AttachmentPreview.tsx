import { useState } from 'react';
import { Download, ExternalLink, FileText, Image as ImageIcon } from 'lucide-react';
import { messageApi } from '../../../api/messageApi';
import type { AttachmentStatus, SharedAssetKind } from '../../../types/chat';
import { formatFileSize } from '../utils/attachmentDisplay';
import type { AttachmentPreviewTarget } from './AttachmentPreviewModal';

type AttachmentRenderable = {
  attachmentId: string;
  displayName: string;
  mimeType: string;
  size: number;
  kind: SharedAssetKind;
  status: AttachmentStatus;
  localPreviewUrl?: string;
};

interface AttachmentPreviewProps {
  attachment: AttachmentRenderable;
  compact?: boolean;
  onOpenPreview?: (attachment: AttachmentPreviewTarget) => void;
}

const getFileTypeLabel = (mimeType: string, displayName: string) => {
  const extension = displayName.includes('.') ? displayName.split('.').pop()?.toUpperCase() : '';

  if (extension) {
    return extension;
  }

  if (mimeType.startsWith('image/')) {
    return 'Image';
  }

  return 'File';
};

const AttachmentPreview = ({ attachment, compact = false, onOpenPreview }: AttachmentPreviewProps) => {
  const [hasPreviewError, setHasPreviewError] = useState(false);
  const isUnavailable = attachment.status !== 'active';
  const previewUrl = isUnavailable ? null : attachment.localPreviewUrl ?? messageApi.getAttachmentPreviewUrl(attachment.attachmentId);
  const downloadUrl = isUnavailable ? null : messageApi.getAttachmentDownloadUrl(attachment.attachmentId);
  const isProtectedRemotePreview = Boolean(previewUrl && !attachment.localPreviewUrl);
  const fileTypeLabel = getFileTypeLabel(attachment.mimeType, attachment.displayName);

  if (attachment.kind === 'media') {
    return (
      <div
        className={`overflow-hidden rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] ${
          compact ? 'aspect-square' : 'mt-2 max-w-[320px]'
        }`}
      >
        {previewUrl && !hasPreviewError ? (
          <button
            type="button"
            onClick={() => onOpenPreview?.(attachment)}
            aria-label={`Open ${attachment.displayName}`}
            className="block w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          >
            <img
              src={previewUrl}
              alt={attachment.displayName}
              crossOrigin={isProtectedRemotePreview ? 'use-credentials' : undefined}
              onError={() => setHasPreviewError(true)}
              className={`${compact ? 'h-full w-full' : 'max-h-64 w-full'} object-cover`}
            />
          </button>
        ) : (
          <div className="grid min-h-28 place-items-center gap-2 px-3 py-4 text-center text-xs text-[var(--chat-text-muted)]">
            <ImageIcon aria-hidden="true" className="h-6 w-6" />
            <span>{isUnavailable ? 'Media unavailable' : 'Preview unavailable'}</span>
          </div>
        )}
        {!compact && (
          <div className="flex min-w-0 items-center justify-between gap-3 border-t border-[var(--chat-border)] px-3 py-2 text-xs">
            <span className="min-w-0 truncate text-[var(--chat-text)]">{attachment.displayName}</span>
            <span className="shrink-0 text-[var(--chat-text-muted)]">{formatFileSize(attachment.size)}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 flex min-w-0 items-center gap-3 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] px-3 py-2 text-[var(--chat-text)]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel-subtle)] text-[var(--chat-accent)]">
        <FileText aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{attachment.displayName}</span>
        <span className="block truncate text-xs text-[var(--chat-text-muted)]">
          {fileTypeLabel} - {formatFileSize(attachment.size)}
        </span>
      </span>
      {isUnavailable ? (
        <span className="shrink-0 text-xs text-[var(--chat-text-muted)]">Unavailable</span>
      ) : (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onOpenPreview?.(attachment)}
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label={`Open ${attachment.displayName}`}
          >
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </button>
          <a
            href={downloadUrl ?? undefined}
            className="grid h-9 w-9 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label={`Download ${attachment.displayName}`}
          >
            <Download aria-hidden="true" className="h-4 w-4" />
          </a>
        </span>
      )}
    </div>
  );
};

export default AttachmentPreview;
