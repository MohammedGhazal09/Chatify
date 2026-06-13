import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeUser } from '../../../test/chatFixtures';
import type { CallControllerState } from '../../../hooks/useCallController';
import CallOverlay from './CallOverlay';

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

const renderOverlay = (state: Partial<CallControllerState>) => {
  const handlers = {
    onAccept: vi.fn(),
    onReject: vi.fn(),
    onEnd: vi.fn(),
    onToggleMute: vi.fn(),
    onToggleCamera: vi.fn(),
  };

  render(<CallOverlay callState={{ ...baseCallState, ...state }} {...handlers} />);
  return handlers;
};

describe('CallOverlay', () => {
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

  it('controls active video calls', async () => {
    const user = userEvent.setup();
    const handlers = renderOverlay({
      status: 'connected',
      mode: 'video',
      connectedAt: new Date().toISOString(),
      localStream: new MediaStream(),
      remoteStream: new MediaStream(),
    });

    expect(screen.getByRole('dialog', { name: 'Call controls' })).toBeInTheDocument();
    expect(screen.getByLabelText('Remote video')).toBeInTheDocument();
    expect(screen.getByLabelText('Local preview')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mute microphone' }));
    await user.click(screen.getByRole('button', { name: 'Turn camera off' }));
    await user.click(screen.getByRole('button', { name: 'End call' }));

    expect(handlers.onToggleMute).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleCamera).toHaveBeenCalledTimes(1);
    expect(handlers.onEnd).toHaveBeenCalledTimes(1);
  });
});
