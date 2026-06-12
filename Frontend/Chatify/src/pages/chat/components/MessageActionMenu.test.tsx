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
  onToggleReactionPicker?: () => void;
}

const MenuHarness = ({
  onReaction,
  onReply = vi.fn(),
  onStartEdit = vi.fn(),
  onDelete = vi.fn(),
  onCopy = vi.fn(),
  onToggleReactionPicker = vi.fn(),
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
        onClick={() => setContextMenu({ messageId: 'message-1', x: 8, y: 12, isOwn: true })}
      >
        Open message actions
      </button>
      <MessageActionMenu
        contextMenu={contextMenu}
        messages={[message]}
        showReactionPicker={false}
        contextMenuRef={contextMenuRef}
        onReaction={onReaction}
        onToggleReactionPicker={onToggleReactionPicker}
        onReply={onReply}
        onStartEdit={onStartEdit}
        onDelete={onDelete}
        onCopy={onCopy}
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
    const onToggleReactionPicker = vi.fn();

    render(
      <MenuHarness
        onReaction={onReaction}
        onReply={onReply}
        onStartEdit={onStartEdit}
        onDelete={onDelete}
        onCopy={onCopy}
        onToggleReactionPicker={onToggleReactionPicker}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Open message actions' }));
    await user.click(screen.getByRole('button', { name: 'Reply' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await user.click(screen.getByRole('button', { name: 'Delete for me' }));
    await user.click(screen.getByRole('button', { name: 'Delete for everyone' }));
    await user.click(screen.getByRole('button', { name: 'More reactions' }));

    expect(onReply).toHaveBeenCalledWith(expect.objectContaining({ _id: 'message-1', text: 'Copy me' }));
    expect(onStartEdit).toHaveBeenCalledWith('message-1', 'Copy me');
    expect(onCopy).toHaveBeenCalledWith(expect.objectContaining({ _id: 'message-1' }));
    expect(onDelete).toHaveBeenNthCalledWith(1, false);
    expect(onDelete).toHaveBeenNthCalledWith(2, true);
    expect(onToggleReactionPicker).toHaveBeenCalledTimes(1);
  });
});
