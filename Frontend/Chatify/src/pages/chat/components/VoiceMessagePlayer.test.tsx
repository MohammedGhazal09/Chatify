import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeAttachment } from '../../../test/chatFixtures';
import VoiceMessagePlayer from './VoiceMessagePlayer';

vi.mock('../../../api/apiOrigin', () => ({
  resolveApiBaseUrl: vi.fn(() => 'https://backend.test'),
}));

const makeVoiceAttachment = () => makeAttachment({
  attachmentId: 'voice-1',
  displayName: 'voice-message.webm',
  mimeType: 'audio/webm',
  kind: 'voice',
  size: 5,
  durationSeconds: 4,
});

describe('VoiceMessagePlayer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses protected playback and download URLs for remote voice messages', () => {
    const { container } = render(<VoiceMessagePlayer attachment={makeVoiceAttachment()} />);
    const audio = container.querySelector('audio');

    expect(audio).toHaveAttribute('src', 'https://backend.test/api/message/attachments/voice-1/preview');
    expect(audio).toHaveAttribute('crossorigin', 'use-credentials');
    expect(screen.getByRole('link', { name: 'Download voice-message.webm' })).toHaveAttribute(
      'href',
      'https://backend.test/api/message/attachments/voice-1/download'
    );
    expect(screen.getByText('0:04')).toBeInTheDocument();
    expect(screen.getByText('5 B')).toBeInTheDocument();
  });

  it('supports play and pause with accessible pressed state', async () => {
    const user = userEvent.setup();
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function playMock(this: HTMLMediaElement) {
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    });
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function pauseMock(this: HTMLMediaElement) {
      this.dispatchEvent(new Event('pause'));
    });
    const { container } = render(<VoiceMessagePlayer attachment={makeVoiceAttachment()} />);
    const audio = container.querySelector('audio');

    expect(audio).not.toBeNull();
    fireEvent.canPlay(audio as HTMLAudioElement);

    const playButton = screen.getByRole('button', { name: 'Play voice-message.webm' });
    expect(playButton).toBeEnabled();

    await user.click(playButton);

    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Pause voice-message.webm' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Pause voice-message.webm' }));

    expect(pause).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Play voice-message.webm' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows a recoverable error state when playback fails', async () => {
    const user = userEvent.setup();
    const { container } = render(<VoiceMessagePlayer attachment={makeVoiceAttachment()} />);
    const audio = container.querySelector('audio');

    expect(audio).not.toBeNull();
    fireEvent.error(audio as HTMLAudioElement);

    expect(screen.getByText('Playback failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play voice-message.webm' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Retry voice-message.webm' }));

    expect(screen.queryByText('Playback failed')).not.toBeInTheDocument();
  });
});
