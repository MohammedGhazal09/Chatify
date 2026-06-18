import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeUser } from '../../../test/chatFixtures';
import type { CallControllerState } from '../../../hooks/useCallController';
import CallOverlay from './CallOverlay';

const soundMocks = vi.hoisted(() => ({
  startCallToneLoop: vi.fn(),
  stopCallTone: vi.fn(),
}));

vi.mock('../../../utils/sounds', () => ({
  startCallToneLoop: soundMocks.startCallToneLoop,
}));

const baseCallState: CallControllerState = {
  status: 'idle',
  session: null,
  mode: null,
  peer: makeUser({ _id: 'user-2', firstName: 'Grace', lastName: 'Hopper' }),
  localStream: null,
  remoteStream: null,
  muted: false,
  cameraEnabled: true,
  audioFallbackOffered: false,
  error: null,
  startedAt: null,
  connectedAt: null,
};

const renderOverlay = (
  state: Partial<CallControllerState>,
  options: { shouldPlayCallTone?: boolean } = {}
) => {
  const handlers = {
    onAccept: vi.fn(),
    onReject: vi.fn(),
    onEnd: vi.fn(),
    onToggleMute: vi.fn(),
    onToggleCamera: vi.fn(),
  };

  const view = render(
    <CallOverlay
      callState={{ ...baseCallState, ...state }}
      shouldPlayCallTone={options.shouldPlayCallTone ?? false}
      {...handlers}
    />
  );
  return { ...handlers, ...view };
};

describe('CallOverlay', () => {
  beforeEach(() => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    soundMocks.startCallToneLoop.mockReturnValue(soundMocks.stopCallTone);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    soundMocks.startCallToneLoop.mockReset();
    soundMocks.stopCallTone.mockReset();
  });

  it('does not render while idle', () => {
    renderOverlay({ status: 'idle' });

    expect(screen.queryByRole('dialog', { name: 'Call controls' })).not.toBeInTheDocument();
  });

  it('accepts or rejects incoming calls', async () => {
    const user = userEvent.setup();
    const handlers = renderOverlay({
      status: 'incoming',
      mode: 'audio',
      startedAt: '2026-06-13T10:00:00.000Z',
    });

    expect(screen.getByRole('dialog', { name: 'Call controls' })).toBeInTheDocument();
    expect(screen.getByText('Incoming audio call from Grace Hopper')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Accept call' }));
    await user.click(screen.getByRole('button', { name: 'Reject call' }));

    expect(handlers.onAccept).toHaveBeenCalledTimes(1);
    expect(handlers.onReject).toHaveBeenCalledTimes(1);
  });

  it('plays the incoming call tone when sound is enabled', () => {
    renderOverlay({
      status: 'incoming',
      mode: 'audio',
      startedAt: '2026-06-13T10:00:00.000Z',
    }, { shouldPlayCallTone: true });

    expect(soundMocks.startCallToneLoop).toHaveBeenCalledWith('incoming');
    expect(screen.getByText('Answer when ready')).toBeInTheDocument();
  });

  it('plays the outgoing call tone while waiting for an answer', () => {
    renderOverlay({
      status: 'outgoing',
      mode: 'audio',
      startedAt: '2026-06-13T10:00:00.000Z',
    }, { shouldPlayCallTone: true });

    expect(soundMocks.startCallToneLoop).toHaveBeenCalledWith('outgoing');
    expect(screen.getByText('Waiting for answer')).toBeInTheDocument();
  });

  it('does not start a call tone when sound is disabled', () => {
    renderOverlay({
      status: 'ringing',
      mode: 'audio',
      startedAt: '2026-06-13T10:00:00.000Z',
    }, { shouldPlayCallTone: false });

    expect(soundMocks.startCallToneLoop).not.toHaveBeenCalled();
  });

  it('stops the call tone when the call leaves the ringing state', () => {
    const handlers = {
      onAccept: vi.fn(),
      onReject: vi.fn(),
      onEnd: vi.fn(),
      onToggleMute: vi.fn(),
      onToggleCamera: vi.fn(),
    };
    const { rerender, unmount } = render(
      <CallOverlay
        callState={{ ...baseCallState, status: 'outgoing', mode: 'audio' }}
        shouldPlayCallTone
        {...handlers}
      />
    );

    expect(soundMocks.startCallToneLoop).toHaveBeenCalledWith('outgoing');

    rerender(
      <CallOverlay
        callState={{ ...baseCallState, status: 'connecting', mode: 'audio' }}
        shouldPlayCallTone
        {...handlers}
      />
    );

    expect(soundMocks.stopCallTone).toHaveBeenCalledTimes(1);

    unmount();
    expect(soundMocks.stopCallTone).toHaveBeenCalledTimes(1);
  });

  it('attaches the remote stream to audio playback during active audio calls', () => {
    const remoteStream = new MediaStream();

    renderOverlay({
      status: 'connected',
      mode: 'audio',
      connectedAt: new Date().toISOString(),
      remoteStream,
    });

    const remoteAudio = screen.getByTestId('remote-call-audio') as HTMLAudioElement;

    expect(remoteAudio.srcObject).toBe(remoteStream);
    expect(remoteAudio.muted).toBe(false);
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it('controls active video calls', async () => {
    const user = userEvent.setup();
    const remoteStream = new MediaStream();
    const handlers = renderOverlay({
      status: 'connected',
      mode: 'video',
      connectedAt: new Date().toISOString(),
      localStream: new MediaStream(),
      remoteStream,
    });
    const remoteVideo = screen.getByLabelText('Remote video') as HTMLVideoElement;
    const remoteAudio = screen.getByTestId('remote-call-audio') as HTMLAudioElement;

    expect(screen.getByRole('dialog', { name: 'Call controls' })).toBeInTheDocument();
    expect(remoteVideo).toBeInTheDocument();
    expect(remoteVideo.muted).toBe(true);
    expect(remoteAudio.srcObject).toBe(remoteStream);
    expect(remoteAudio.muted).toBe(false);
    expect(screen.getByLabelText('Local preview')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mute microphone' }));
    await user.click(screen.getByRole('button', { name: 'Turn camera off' }));
    await user.click(screen.getByRole('button', { name: 'End call' }));

    expect(handlers.onToggleMute).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleCamera).toHaveBeenCalledTimes(1);
    expect(handlers.onEnd).toHaveBeenCalledTimes(1);
  });

  it('shows a failed video call without the fallback copy', () => {
    renderOverlay({
      status: 'failed',
      mode: 'video',
      error: 'Could not access the camera for this video call.',
    });

    expect(screen.getByRole('dialog', { name: 'Call controls' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Could not access the camera for this video call.' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not access the camera for this video call.');
    expect(screen.queryByText('Camera unavailable. Audio fallback is active.')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Remote video')).not.toBeInTheDocument();
  });
});
