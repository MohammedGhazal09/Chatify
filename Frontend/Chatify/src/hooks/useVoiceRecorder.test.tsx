import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceRecorder } from './useVoiceRecorder';

class MockMediaRecorder {
  static isTypeSupported = vi.fn(() => true);

  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  stream: MediaStream;
  options?: MediaRecorderOptions;

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.stream = stream;
    this.options = options;
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({
      data: new Blob(['voice'], { type: this.options?.mimeType ?? 'audio/webm' }),
    } as BlobEvent);
    this.onstop?.();
  }
}

const buildMediaStream = (trackStop = vi.fn()) => ({
  getTracks: () => [
    {
      stop: trackStop,
    },
  ],
}) as unknown as MediaStream;

describe('useVoiceRecorder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-17T00:00:00.000Z'));
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(buildMediaStream()),
      },
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:voice-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports unsupported state when MediaRecorder is unavailable', () => {
    vi.stubGlobal('MediaRecorder', undefined);

    const { result } = renderHook(() => useVoiceRecorder());

    expect(result.current.isSupported).toBe(false);
    expect(result.current.status).toBe('unsupported');
    expect(result.current.canRecord).toBe(false);
  });

  it('records a supported voice draft with duration metadata', async () => {
    const { result, unmount } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    act(() => {
      result.current.stopRecording();
    });

    expect(result.current.status).toBe('preview');

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(result.current.draft).toMatchObject({
      displayName: expect.stringMatching(/^voice-message-\d+\.webm$/),
      kind: 'voice',
      mimeType: 'audio/webm;codecs=opus',
      durationSeconds: 1.5,
      localPreviewUrl: 'blob:voice-preview',
    });

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:voice-preview');
  });

  it('cancels recording without preserving a draft', async () => {
    const trackStop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue(buildMediaStream(trackStop));
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia,
      },
    });
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    act(() => {
      result.current.cancelRecording();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.draft).toBeNull();
    expect(result.current.durationSeconds).toBe(0);
    expect(trackStop).toHaveBeenCalledTimes(1);
  });

  it('reports permission denial as a recoverable status', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')),
      },
    });
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe('permission_denied');
    expect(result.current.errorMessage).toBe('Microphone permission is required to record a voice message.');
    expect(result.current.canRecord).toBe(true);
  });

  it('reports missing microphone as a recoverable status', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('Missing', 'NotFoundError')),
      },
    });
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe('no_device');
    expect(result.current.errorMessage).toBe('No microphone is available.');
    expect(result.current.canRecord).toBe(true);
  });

  it('stops the acquired stream when MediaRecorder construction fails', async () => {
    const trackStop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue(buildMediaStream(trackStop));

    class ThrowingMediaRecorder extends MockMediaRecorder {
      constructor(stream: MediaStream, options?: MediaRecorderOptions) {
        super(stream, options);
        throw new Error('Recorder construction failed');
      }
    }

    vi.stubGlobal('MediaRecorder', ThrowingMediaRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia,
      },
    });

    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(trackStop).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('permission_denied');
  });
});
