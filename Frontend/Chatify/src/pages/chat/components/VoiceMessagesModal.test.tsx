import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeSharedAsset } from '../../../test/chatFixtures';
import VoiceMessagesModal from './VoiceMessagesModal';

vi.mock('../../../api/apiOrigin', () => ({
  resolveApiBaseUrl: vi.fn(() => 'https://backend.test'),
}));

const voiceAsset = makeSharedAsset({
  attachmentId: 'voice-1',
  messageId: 'message-voice',
  displayName: 'voice-message.webm',
  mimeType: 'audio/webm',
  kind: 'voice',
  size: 5,
  durationSeconds: 4,
});

const renderModal = (overrides = {}) => {
  const props = {
    isOpen: true,
    assets: [voiceAsset],
    isLoading: false,
    isError: false,
    hasMore: false,
    isFetchingMore: false,
    onLoadMore: vi.fn(),
    onClose: vi.fn(),
    onJumpToMessage: vi.fn(),
    ...overrides,
  };

  const view = render(<VoiceMessagesModal {...props} />);

  return { props, ...view };
};

describe('VoiceMessagesModal', () => {
  it('renders voice assets with protected playback and download URLs', () => {
    const { container } = renderModal();
    const audio = container.querySelector('audio');

    expect(screen.getByRole('dialog', { name: 'Voice messages' })).toBeInTheDocument();
    expect(screen.getByText('voice-message.webm')).toBeInTheDocument();
    expect(screen.getByText('0:04')).toBeInTheDocument();
    expect(screen.getByText('5 B')).toBeInTheDocument();
    expect(audio).toHaveAttribute('src', 'https://backend.test/api/message/attachments/voice-1/preview');
    expect(audio).toHaveAttribute('crossorigin', 'use-credentials');
    expect(screen.getByRole('link', { name: 'Download voice-message.webm' })).toHaveAttribute(
      'href',
      'https://backend.test/api/message/attachments/voice-1/download'
    );
  });

  it('closes from the close button, backdrop, and Escape key', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderModal({ onClose });

    await user.click(screen.getByRole('button', { name: 'Close voice messages' }));
    await user.click(screen.getByRole('button', { name: 'Close voice messages backdrop' }));
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('jumps to the source message for a voice asset', async () => {
    const user = userEvent.setup();
    const onJumpToMessage = vi.fn();

    renderModal({ onJumpToMessage });

    await user.click(screen.getByRole('button', { name: 'Jump to voice-message.webm' }));

    expect(onJumpToMessage).toHaveBeenCalledWith('message-voice');
  });

  it('shows the load older action only when more pages are available', async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    const { rerender } = renderModal({ hasMore: true, onLoadMore });

    await user.click(screen.getByRole('button', { name: 'Load older voice messages' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(
      <VoiceMessagesModal
        isOpen
        assets={[voiceAsset]}
        isLoading={false}
        isError={false}
        hasMore={false}
        isFetchingMore={false}
        onLoadMore={onLoadMore}
        onClose={vi.fn()}
        onJumpToMessage={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: 'Load older voice messages' })).not.toBeInTheDocument();
  });
});
