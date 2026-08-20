import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComposerAttachmentDraft } from '../types/chat';

export const MIN_VOICE_DURATION_SECONDS = 1;
export const MAX_VOICE_DURATION_SECONDS = 120;
export const MAX_VOICE_SIZE_BYTES = 10 * 1024 * 1024;

const VOICE_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

export type VoiceRecorderStatus =
  | 'idle'
  | 'unsupported'
  | 'permission_denied'
  | 'no_device'
  | 'recording'
  | 'preview'
  | 'failed';

export interface UseVoiceRecorderResult {
  status: VoiceRecorderStatus;
  isSupported: boolean;
  isRecording: boolean;
  canRecord: boolean;
  draft: ComposerAttachmentDraft | null;
  durationSeconds: number;
  errorMessage: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  clearDraft: () => void;
}

const canUseMediaRecorder = () => (
  typeof navigator !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof MediaRecorder !== 'undefined'
);

const getSupportedVoiceMimeType = () => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }

  return VOICE_MIME_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? '';
};

const getVoiceExtension = (mimeType: string) => {
  if (mimeType.includes('ogg')) {
    return 'ogg';
  }

  if (mimeType.includes('opus') && !mimeType.includes('webm')) {
    return 'opus';
  }

  return 'webm';
};

const createVoiceDraft = ({
  blob,
  durationSeconds,
  mimeType,
}: {
  blob: Blob;
  durationSeconds: number;
  mimeType: string;
}): ComposerAttachmentDraft => {
  const extension = getVoiceExtension(mimeType);
  const displayName = `voice-message-${Date.now()}.${extension}`;
  const file = new File([blob], displayName, { type: mimeType || blob.type || 'audio/webm' });

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    displayName,
    mimeType: file.type || 'audio/webm',
    size: file.size,
    kind: 'voice',
    durationSeconds,
    localPreviewUrl: typeof URL !== 'undefined' && 'createObjectURL' in URL
      ? URL.createObjectURL(blob)
      : undefined,
  };
};

export const useVoiceRecorder = (): UseVoiceRecorderResult => {
  const isSupported = useMemo(() => canUseMediaRecorder() && Boolean(getSupportedVoiceMimeType()), []);
  const [status, setStatus] = useState<VoiceRecorderStatus>(isSupported ? 'idle' : 'unsupported');
  const [draft, setDraft] = useState<ComposerAttachmentDraft | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickTimerRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const discardRecordingRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (tickTimerRef.current !== null) {
      window.clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }

    if (maxTimerRef.current !== null) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearDraft = useCallback(() => {
    setDraft((currentDraft) => {
      if (currentDraft?.localPreviewUrl) {
        URL.revokeObjectURL(currentDraft.localPreviewUrl);
      }

      return null;
    });
    setDurationSeconds(0);
    if (isSupported) {
      setStatus('idle');
      setErrorMessage(null);
    }
  }, [isSupported]);

  const finishRecording = useCallback(() => {
    clearTimers();
    stopStream();

    if (discardRecordingRef.current) {
      discardRecordingRef.current = false;
      chunksRef.current = [];
      setDurationSeconds(0);
      return;
    }

    const mimeType = getSupportedVoiceMimeType() || chunksRef.current[0]?.type || 'audio/webm';
    const duration = Math.round(((Date.now() - startedAtRef.current) / 1000) * 1000) / 1000;
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];

    if (duration < MIN_VOICE_DURATION_SECONDS || blob.size <= 0) {
      setStatus('failed');
      setErrorMessage(`Voice messages must be at least ${MIN_VOICE_DURATION_SECONDS} second long.`);
      setDurationSeconds(duration);
      return;
    }

    if (duration > MAX_VOICE_DURATION_SECONDS || blob.size > MAX_VOICE_SIZE_BYTES) {
      setStatus('failed');
      setErrorMessage('Voice messages cannot exceed 2 minutes or 10 MB.');
      setDurationSeconds(duration);
      return;
    }

    clearDraft();
    setDraft(createVoiceDraft({ blob, durationSeconds: duration, mimeType }));
    setDurationSeconds(duration);
    setStatus('preview');
    setErrorMessage(null);
  }, [clearDraft, clearTimers, stopStream]);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setStatus('unsupported');
      setErrorMessage('Voice recording is not supported in this browser.');
      return;
    }

    clearDraft();
    chunksRef.current = [];
    discardRecordingRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = getSupportedVoiceMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = finishRecording;
      startedAtRef.current = Date.now();
      setDurationSeconds(0);
      setStatus('recording');
      setErrorMessage(null);
      recorder.start();

      tickTimerRef.current = window.setInterval(() => {
        setDurationSeconds(Math.round(((Date.now() - startedAtRef.current) / 1000) * 10) / 10);
      }, 250);
      maxTimerRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, MAX_VOICE_DURATION_SECONDS * 1000);
    } catch (error) {
      stopStream();
      const errorName = error instanceof DOMException ? error.name : '';

      if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        setStatus('no_device');
        setErrorMessage('No microphone is available.');
        return;
      }

      setStatus('permission_denied');
      setErrorMessage('Microphone permission is required to record a voice message.');
    }
  }, [clearDraft, finishRecording, isSupported, stopStream]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;

    if (recorder?.state === 'recording') {
      recorder.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    discardRecordingRef.current = true;
    const recorder = recorderRef.current;

    if (recorder?.state === 'recording') {
      recorder.stop();
    }

    clearTimers();
    stopStream();
    chunksRef.current = [];
    clearDraft();
    if (isSupported) {
      setStatus('idle');
      setErrorMessage(null);
    }
  }, [clearDraft, clearTimers, isSupported, stopStream]);

  useEffect(() => {
    return () => {
      clearTimers();
      stopStream();
      if (draft?.localPreviewUrl) {
        URL.revokeObjectURL(draft.localPreviewUrl);
      }
    };
  }, [clearTimers, draft?.localPreviewUrl, stopStream]);

  return {
    status,
    isSupported,
    isRecording: status === 'recording',
    canRecord: isSupported && status !== 'recording',
    draft,
    durationSeconds,
    errorMessage,
    startRecording,
    stopRecording,
    cancelRecording,
    clearDraft,
  };
};
