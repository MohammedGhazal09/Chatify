import { useRef, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeMessage } from '../../../test/chatFixtures';
import type { MessageContextMenuState } from '../hooks/useChatViewState';
import MessageActionMenu from './MessageActionMenu';

interface MenuHarnessProps {
  onReaction: (messageId: string, emoji: string) => void;
}

const MenuHarness = ({ onReaction }: MenuHarnessProps) => {
  const [contextMenu, setContextMenu] = useState<MessageContextMenuState | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

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
        messages={[makeMessage({ _id: 'message-1', text: 'Copy me' })]}
        showReactionPicker={false}
        contextMenuRef={contextMenuRef}
        onReaction={onReaction}
        onToggleReactionPicker={vi.fn()}
        onReply={vi.fn()}
        onStartEdit={vi.fn()}
        onDelete={vi.fn()}
        onCopy={vi.fn()}
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
});
