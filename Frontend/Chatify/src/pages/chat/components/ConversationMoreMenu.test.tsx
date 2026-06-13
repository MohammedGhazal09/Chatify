import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ConversationControls } from '../../../types/chat';
import ConversationMoreMenu from './ConversationMoreMenu';

const conversationControls: ConversationControls = {
  isDirectChat: true,
  peerId: 'user-2',
  canSendMessage: true,
  canBlockUser: true,
  canUnblockUser: false,
  blockedByMe: false,
  blockedMe: false,
  messagingDisabledReason: null,
};

const renderMenu = (overrides: Partial<Parameters<typeof ConversationMoreMenu>[0]> = {}) => {
  const anchorRef = createRef<HTMLButtonElement>();
  const props = {
    isOpen: true,
    anchorRef,
    conversationControls,
    canExport: true,
    isActionPending: false,
    onOpenDetails: vi.fn(),
    onStartAudioCall: vi.fn(),
    onStartVideoCall: vi.fn(),
    onSearchMessages: vi.fn(),
    onExportChat: vi.fn(),
    onBlockUser: vi.fn(),
    onUnblockUser: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };

  render(
    <>
      <button ref={anchorRef} type="button">Anchor</button>
      <ConversationMoreMenu {...props} />
    </>
  );

  return props;
};

describe('ConversationMoreMenu', () => {
  it('starts calls from the overflow menu', async () => {
    const user = userEvent.setup();
    const props = renderMenu();

    await user.click(screen.getByRole('menuitem', { name: 'Call' }));
    await user.click(screen.getByRole('menuitem', { name: 'Video call' }));

    expect(props.onStartAudioCall).toHaveBeenCalledTimes(1);
    expect(props.onStartVideoCall).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it('uses call availability reasons to disable unavailable actions', () => {
    renderMenu({
      callDisabledReason: 'Realtime connection is unavailable.',
      videoCallDisabledReason: 'Both users must be online to call.',
    });

    expect(screen.getByRole('menuitem', { name: 'Call' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Call' })).toHaveAttribute('title', 'Realtime connection is unavailable.');
    expect(screen.getByRole('menuitem', { name: 'Video call' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Video call' })).toHaveAttribute('title', 'Both users must be online to call.');
  });
});
