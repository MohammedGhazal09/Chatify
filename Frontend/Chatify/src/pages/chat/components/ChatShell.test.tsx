import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ChatShell from './ChatShell';

describe('ChatShell', () => {
  it('renders shell regions and closes the mobile overlay', async () => {
    const user = userEvent.setup();
    const onCloseSidebar = vi.fn();

    render(
      <ChatShell
        isSidebarOpen
        onCloseSidebar={onCloseSidebar}
        sidebar={<aside data-testid="chat-sidebar">Sidebar</aside>}
        conversation={<div>Conversation</div>}
        rightRail={<aside data-testid="chat-context-rail">Details</aside>}
      />
    );

    expect(screen.getByTestId('chat-shell')).toBeInTheDocument();
    expect(screen.getByTestId('chat-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('conversation-pane')).toBeInTheDocument();
    expect(screen.getByTestId('chat-context-rail')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close chat list' }));
    expect(onCloseSidebar).toHaveBeenCalledTimes(1);
  });
});
