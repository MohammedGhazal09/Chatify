import { Mic, MicOff, Phone, PhoneOff, RefreshCw, Video, VideoOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import type { CallControllerState } from '../../../hooks/useCallController';

interface CallOverlayProps {
  callState: CallControllerState;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
}

const formatElapsed = (startedAt: string | null, now: number) => {
  if (!startedAt) {
    return '00:00';
  }

  const elapsedSeconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
  const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const getStatusCopy = (callState: CallControllerState) => {
  const peerName = callState.peer
    ? `${callState.peer.firstName} ${callState.peer.lastName ?? ''}`.trim()
    : 'Conversation member';

  if (callState.status === 'incoming') {
    return `Incoming ${callState.mode ?? 'audio'} call from ${peerName}`;
  }

  if (callState.status === 'outgoing' || callState.status === 'ringing') {
    return `Calling ${peerName}`;
  }

  if (callState.status === 'connecting') {
    return `Connecting to ${peerName}`;
  }

  if (callState.status === 'connected') {
    return `Connected with ${peerName}`;
  }

  if (callState.status === 'reconnecting') {
    return `Reconnecting to ${peerName}`;
  }

  if (callState.status === 'busy') {
    return `${peerName} is already in a call`;
  }

  if (callState.status === 'permission_denied') {
    return 'Media permission is required for calls';
  }

  if (callState.status === 'failed') {
    return callState.error ?? 'Call failed';
  }

  if (callState.status === 'missed') {
    return 'Call missed';
  }

  if (callState.status === 'rejected') {
    return 'Call rejected';
  }

  return 'Call ended';
};

const shouldRenderOverlay = (status: CallControllerState['status']) => (
  status !== 'idle' && status !== 'ended'
);

const CallOverlay = ({
  callState,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleCamera,
}: CallOverlayProps) => {
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const statusCopy = getStatusCopy(callState);
  const elapsed = useMemo(
    () => formatElapsed(callState.connectedAt ?? callState.startedAt, now),
    [callState.connectedAt, callState.startedAt, now]
  );

  useEffect(() => {
    if (!shouldRenderOverlay(callState.status)) {
      return undefined;
    }

    primaryButtonRef.current?.focus();
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [callState.status]);

  if (!shouldRenderOverlay(callState.status)) {
    return null;
  }

  const isIncoming = callState.status === 'incoming';
  const isConnected = callState.status === 'connected' || callState.status === 'reconnecting';
  const isVideo = callState.mode === 'video' && (
    callState.status === 'incoming'
    || callState.status === 'outgoing'
    || callState.status === 'ringing'
    || callState.status === 'connecting'
    || callState.status === 'connected'
    || callState.status === 'reconnecting'
  );

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Call controls"
    >
      <section className={`w-full max-w-[520px] overflow-hidden rounded-[var(--chat-radius-lg)] border border-[var(--chat-border)] bg-[var(--chat-panel)] text-[var(--chat-text)] shadow-[var(--chat-shadow)] ${isVideo ? 'sm:max-w-[720px]' : ''}`}>
        <div className="border-b border-[var(--chat-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] text-[var(--chat-accent)]">
              {callState.mode === 'video'
                ? <Video aria-hidden="true" className="h-6 w-6" />
                : <Phone aria-hidden="true" className="h-6 w-6" />}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold">{statusCopy}</h2>
              <p className="text-sm text-[var(--chat-text-muted)]" aria-live="polite">
                {isConnected ? elapsed : 'Secure session active'}
              </p>
            </div>
          </div>
        </div>

        {isVideo && (
          <div className="grid min-h-[280px] bg-[var(--chat-bg)] p-4 sm:grid-cols-[1fr_180px] sm:gap-4">
            <VideoSurface label="Remote video" stream={callState.remoteStream} muted={false} />
            <VideoSurface label="Local preview" stream={callState.localStream} muted />
          </div>
        )}

        {!isVideo && (
          <div className="px-5 py-5">
            <div className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] px-4 py-5 text-sm text-[var(--chat-text-muted)]">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-[var(--chat-border)] text-[var(--chat-accent)]">
                {callState.status === 'reconnecting'
                  ? <RefreshCw aria-hidden="true" className="h-7 w-7" />
                  : <Phone aria-hidden="true" className="h-7 w-7" />}
              </div>
            </div>
          </div>
        )}

        {callState.error && (
          <p className="px-5 pb-2 text-sm text-[var(--chat-danger)]" role="alert">
            {callState.error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 px-5 pb-5">
          {isIncoming && (
            <>
              <CallButton
                buttonRef={primaryButtonRef}
                tone="success"
                label="Accept call"
                icon={<Phone aria-hidden="true" className="h-5 w-5" />}
                onClick={onAccept}
              />
              <CallButton
                tone="danger"
                label="Reject call"
                icon={<PhoneOff aria-hidden="true" className="h-5 w-5" />}
                onClick={onReject}
              />
            </>
          )}

          {!isIncoming && (
            <>
              {isConnected && (
                <>
                  <CallButton
                    label={callState.muted ? 'Unmute microphone' : 'Mute microphone'}
                    icon={callState.muted ? <MicOff aria-hidden="true" className="h-5 w-5" /> : <Mic aria-hidden="true" className="h-5 w-5" />}
                    onClick={onToggleMute}
                  />
                  {callState.mode === 'video' && (
                    <CallButton
                      label={callState.cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
                      icon={callState.cameraEnabled ? <Video aria-hidden="true" className="h-5 w-5" /> : <VideoOff aria-hidden="true" className="h-5 w-5" />}
                      onClick={onToggleCamera}
                    />
                  )}
                </>
              )}
              <CallButton
                buttonRef={primaryButtonRef}
                tone="danger"
                label={isConnected ? 'End call' : 'Cancel call'}
                icon={<PhoneOff aria-hidden="true" className="h-5 w-5" />}
                onClick={onEnd}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
};

const VideoSurface = ({ label, stream, muted }: { label: string; stream: MediaStream | null; muted: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative min-h-[180px] overflow-hidden rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        aria-label={label}
        className="h-full min-h-[180px] w-full object-cover"
      />
      {!stream && (
        <div className="absolute inset-0 grid place-items-center text-sm text-[var(--chat-text-muted)]">
          {label} waiting
        </div>
      )}
    </div>
  );
};

const CallButton = ({
  label,
  icon,
  tone = 'default',
  onClick,
  buttonRef,
}: {
  label: string;
  icon: ReactNode;
  tone?: 'default' | 'success' | 'danger';
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) => {
  const toneClass = tone === 'danger'
    ? 'bg-[var(--chat-danger)] text-white hover:brightness-105'
    : tone === 'success'
      ? 'bg-[var(--chat-success)] text-white hover:brightness-105'
      : 'border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] text-[var(--chat-text)] hover:bg-[var(--chat-panel-subtle)]';

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-12 w-12 place-items-center rounded-full shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${toneClass}`}
    >
      {icon}
    </button>
  );
};

export default CallOverlay;
