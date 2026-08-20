import { Download, Pause, Play, RotateCcw } from 'lucide-react';
import { useRef, useState } from 'react';
import { messageApi } from '../../../api/messageApi';
import type { AttachmentStatus, SharedAssetKind } from '../../../types/chat';
import { formatDurationSeconds, formatFileSize } from '../utils/attachmentDisplay';

type VoiceAttachment = {
  attachmentId: string;
  displayName: string;
  mimeType: string;
  size: number;
  kind: SharedAssetKind;
  status: AttachmentStatus;
  durationSeconds?: number | null;
  localPreviewUrl?: string;
};

interface VoiceMessagePlayerProps {
  attachment: VoiceAttachment;
  compact?: boolean;
}

const VOICE_WAVEFORM_BARS = [14, 22, 30, 18, 26, 34, 20, 28, 16, 24, 32, 18, 26, 14];

const VoiceMessagePlayer = ({ attachment, compact = false }: VoiceMessagePlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playbackState, setPlaybackState] = useState<'loading' | 'paused' | 'playing' | 'error'>('loading');
  const [measuredDuration, setMeasuredDuration] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const isUnavailable = attachment.status !== 'active';
  const previewUrl = isUnavailable ? null : attachment.localPreviewUrl ?? messageApi.getAttachmentPreviewUrl(attachment.attachmentId);
  const downloadUrl = isUnavailable ? null : messageApi.getAttachmentDownloadUrl(attachment.attachmentId);
  const durationLabel = formatDurationSeconds(attachment.durationSeconds ?? measuredDuration);
  const isProtectedRemotePreview = Boolean(previewUrl && !attachment.localPreviewUrl);
  const isPlaying = playbackState === 'playing';

  const handleTogglePlayback = () => {
    const audio = audioRef.current;

    if (!audio || isUnavailable || playbackState === 'error') {
      return;
    }

    if (isPlaying) {
      audio.pause();
      return;
    }

    void audio.play().catch(() => {
      setPlaybackState('error');
    });
  };

  const handleRetry = () => {
    setPlaybackState('loading');
    setReloadToken((currentToken) => currentToken + 1);
  };

  const waveformTone = playbackState === 'error' || isUnavailable
    ? 'bg-[color-mix(in_srgb,var(--chat-danger)_45%,var(--chat-panel-subtle))]'
    : isPlaying
      ? 'bg-[var(--chat-accent)]'
      : 'bg-[color-mix(in_srgb,var(--chat-accent)_55%,var(--chat-panel-subtle))]';

  return (
    <div className={`mt-2 min-w-0 max-w-full rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[color-mix(in_srgb,var(--chat-panel-elevated)_92%,var(--chat-accent)_8%)] text-[var(--chat-text)] shadow-sm ${compact ? 'w-full px-2 py-2' : 'w-[min(72vw,360px)] px-3 py-2.5'}`}>
      {previewUrl && !isUnavailable && (
        <audio
          key={`${attachment.attachmentId}-${reloadToken}`}
          ref={audioRef}
          src={previewUrl}
          preload="metadata"
          crossOrigin={isProtectedRemotePreview ? 'use-credentials' : undefined}
          onLoadedMetadata={(event) => {
            const duration = event.currentTarget.duration;
            setMeasuredDuration(Number.isFinite(duration) ? duration : null);
            setPlaybackState('paused');
          }}
          onCanPlay={() => {
            setPlaybackState((currentState) => currentState === 'loading' ? 'paused' : currentState);
          }}
          onPlay={() => setPlaybackState('playing')}
          onPause={() => setPlaybackState('paused')}
          onEnded={() => setPlaybackState('paused')}
          onError={() => setPlaybackState('error')}
        />
      )}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={handleTogglePlayback}
          disabled={isUnavailable || playbackState === 'loading' || playbackState === 'error'}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--chat-accent)] text-[var(--chat-own-text)] shadow-sm transition hover:bg-[var(--chat-accent-strong)] disabled:cursor-not-allowed disabled:bg-[var(--chat-panel-subtle)] disabled:text-[var(--chat-text-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          aria-label={isPlaying ? `Pause ${attachment.displayName}` : `Play ${attachment.displayName}`}
          aria-pressed={isPlaying}
        >
          {isPlaying ? (
            <Pause aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Play aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span className="truncate text-sm font-semibold">{attachment.displayName}</span>
            {!isUnavailable && playbackState !== 'error' && (
              <span className="shrink-0 text-xs font-medium text-[var(--chat-text-muted)]">{durationLabel}</span>
            )}
          </div>
          <div className="mt-2 flex h-8 items-center gap-1" aria-hidden="true">
            {VOICE_WAVEFORM_BARS.map((height, index) => (
              <span
                key={`${height}-${index}`}
                className={`w-1 rounded-full transition-colors ${waveformTone}`}
                style={{ height }}
              />
            ))}
          </div>
          <p className={`truncate text-xs ${playbackState === 'error' || isUnavailable ? 'text-[var(--chat-danger)]' : 'text-[var(--chat-text-muted)]'}`}>
            {isUnavailable
              ? 'Voice message unavailable'
              : playbackState === 'error'
                ? 'Playback failed'
                : formatFileSize(attachment.size)}
          </p>
        </div>
        {playbackState === 'error' && !isUnavailable && (
          <button
            type="button"
            onClick={handleRetry}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label={`Retry ${attachment.displayName}`}
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
        {downloadUrl && (
          <a
            href={downloadUrl}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label={`Download ${attachment.displayName}`}
          >
            <Download aria-hidden="true" className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
};

export default VoiceMessagePlayer;
