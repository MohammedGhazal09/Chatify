import { useRef, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeMessage } from '../../../test/chatFixtures';
import type { MessageContextMenuState } from '../hooks/useChatViewState';
import MessageActionMenu from './MessageActionMenu';

interface MenuHarnessProps {
  onReaction: (messageId: string, emoji: string) => void;
  onReply?: (message: ReturnType<typeof makeMessage>) => void;
  onStartEdit?: (messageId: string, currentText: string) => void;
  onDelete?: (deleteForEveryone: boolean) => void;
  onCopy?: (message: ReturnType<typeof makeMessage>) => void;
  onTogglePin?: (message: ReturnType<typeof makeMessage>) => void;
  onReportMessage?: (message: ReturnType<typeof makeMessage>) => void;
  onToggleReactionPicker?: () => void;
  activeActionsDisabled?: boolean;
  activeActionsDisabledReason?: string | null;
  isOwn?: boolean;
}

const MenuHarness = ({
  onReaction,
  onReply = vi.fn(),
  onStartEdit = vi.fn(),
  onDelete = vi.fn(),
  onCopy = vi.fn(),
  onTogglePin = vi.fn(),
  onReportMessage = vi.fn(),
  onToggleReactionPicker = vi.fn(),
  activeActionsDisabled = false,
  activeActionsDisabledReason = null,
  isOwn = true,
}: MenuHarnessProps) => {
  const [contextMenu, setContextMenu] = useState<MessageContextMenuState | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const message = makeMessage({ _id: 'message-1', text: 'Copy me' });

  const closeMenu = () => {
    setContextMenu(null);
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setContextMenu({ messageId: 'message-1', x: 8, y: 12, isOwn })}
      >
        Open message actions
      </button>
      <MessageActionMenu
        contextMenu={contextMenu}
        messages={[message]}
        showReactionPicker={false}
        activeActionsDisabled={activeActionsDisabled}
        activeActionsDisabledReason={activeActionsDisabledReason}
        contextMenuRef={contextMenuRef}
        onReaction={onReaction}
        onToggleReactionPicker={onToggleReactionPicker}
        onReply={onReply}
        onStartEdit={onStartEdit}
        onDelete={onDelete}
        onCopy={onCopy}
        onTogglePin={onTogglePin}
        onReportMessage={onReportMessage}
        onClose={closeMenu}
      />
    </>
  );
};

describe('MessageActionMenu', () => {
  it('opens from an explicit trigger, keeps quick reactions available, and closes on Escape with focus return', async () => {
    const user = userEvent.setup();
    const onReaction = vi.fn();

    render(<MenuHarness onReaction={onReaction} />);

    const trigger = screen.getByRole('button', { name: 'Open message actions' });
    await user.click(trigger);

    const actions = screen.getByRole('group', { name: 'Message actions' });
    expect(actions).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'React with 😂' }));
    expect(onReaction).toHaveBeenCalledWith('message-1', '😂');
    expect(screen.queryByText('Loading emoji…')).not.toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('group', { name: 'Message actions' })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('routes supported actions to their handlers with the selected message payload', async () => {
    const user = userEvent.setup();
    const onReaction = vi.fn();
    const onReply = vi.fn();
    const onStartEdit = vi.fn();
    const onDelete = vi.fn();
    const onCopy = vi.fn();
    const onTogglePin = vi.fn();
    const onToggleReactionPicker = vi.fn();

    render(
      <MenuHarness
        onReaction={onReaction}
        onReply={onReply}
        onStartEdit={onStartEdit}
        onDelete={onDelete}
        onCopy={onCopy}
        onTogglePin={onTogglePin}
        onToggleReactionPicker={onToggleReactionPicker}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Open message actions' }));
    await user.click(screen.getByRole('button', { name: 'Reply' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await user.click(screen.getByRole('button', { name: 'Pin message' }));
    await user.click(screen.getByRole('button', { name: 'Delete for me' }));
    await user.click(screen.getByRole('button', { name: 'Delete for everyone' }));
    await user.click(screen.getByRole('button', { name: 'More reactions' }));

    expect(onReply).toHaveBeenCalledWith(expect.objectContaining({ _id: 'message-1', text: 'Copy me' }));
    expect(onStartEdit).toHaveBeenCalledWith('message-1', 'Copy me');
    expect(onCopy).toHaveBeenCalledWith(expect.objectContaining({ _id: 'message-1' }));
    expect(onTogglePin).toHaveBeenCalledWith(expect.objectContaining({ _id: 'message-1' }));
    expect(onDelete).toHaveBeenNthCalledWith(1, false);
    expect(onDelete).toHaveBeenNthCalledWith(2, true);
    expect(onToggleReactionPicker).toHaveBeenCalledTimes(1);
  });

  it('disables active message actions while keeping passive actions available', async () => {
    const user = userEvent.setup();
    const onReaction = vi.fn();
    const onReply = vi.fn();
    const onCopy = vi.fn();
    const onDelete = vi.fn();

    render(
      <MenuHarness
        onReaction={onReaction}
        onReply={onReply}
        onCopy={onCopy}
        onDelete={onDelete}
        activeActionsDisabled
        activeActionsDisabledReason="You blocked this user. Unblock them to send new activity."
      />
    );

    await user.click(screen.getByRole('button', { name: 'Open message actions' }));

    expect(screen.getByRole('button', { name: 'React with 😂' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reply' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pin message' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete for everyone' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete for me' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await user.click(screen.getByRole('button', { name: 'Delete for me' }));

    expect(onCopy).toHaveBeenCalledWith(expect.objectContaining({ _id: 'message-1' }));
    expect(onDelete).toHaveBeenCalledWith(false);
    expect(onReaction).not.toHaveBeenCalled();
    expect(onReply).not.toHaveBeenCalled();
  });

  it('lets received messages be deleted only for the current user', async () => {
    const user = userEvent.setup();
    const onReaction = vi.fn();
    const onDelete = vi.fn();
    const onReportMessage = vi.fn();

    render(
      <MenuHarness
        isOwn={false}
        onReaction={onReaction}
        onDelete={onDelete}
        onReportMessage={onReportMessage}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Open message actions' }));

    expect(screen.getByRole('button', { name: 'Delete for me' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Report message' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete for everyone' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Report message' }));
    await user.click(screen.getByRole('button', { name: 'Delete for me' }));

    expect(onReportMessage).toHaveBeenCalledWith(expect.objectContaining({ _id: 'message-1' }));
    expect(onDelete).toHaveBeenCalledWith(false);
  });
});
