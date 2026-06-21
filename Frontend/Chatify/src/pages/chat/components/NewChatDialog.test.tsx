import { useRef, useState } from 'react';
import type { ComponentProps, FormEvent } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import NewChatDialog from './NewChatDialog';

interface DialogHarnessProps {
  onSubmit: ComponentProps<typeof NewChatDialog>['onSubmit'];
  onCreateGroupSubmit?: ComponentProps<typeof NewChatDialog>['onCreateGroupSubmit'];
}

type DirectSubmitOptions = Parameters<ComponentProps<typeof NewChatDialog>['onSubmit']>[1];

const DialogHarness = ({ onSubmit, onCreateGroupSubmit = vi.fn() }: DialogHarnessProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState('');
  const openerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={openerRef} type="button" onClick={() => setIsOpen(true)}>
        New chat
      </button>
      <NewChatDialog
        isOpen={isOpen}
        username={username}
        error={null}
        isSubmitting={false}
        isGroupSubmitting={false}
        openerRef={openerRef}
        onUsernameChange={setUsername}
        onSubmit={onSubmit}
        onCreateGroupSubmit={onCreateGroupSubmit}
        onClearError={vi.fn()}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
};

describe('NewChatDialog', () => {
  it('uses dialog semantics, submits username, and returns focus after Escape close', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());

    render(<DialogHarness onSubmit={onSubmit} />);

    const opener = screen.getByRole('button', { name: 'New chat' });
    await user.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'New chat' });
    expect(dialog).toBeInTheDocument();
    const usernameInput = screen.getByLabelText('Username');
    expect(usernameInput).toHaveFocus();
    expect(usernameInput).toHaveAttribute('name', 'targetUsername');

    await user.type(usernameInput, 'friend.name');
    await user.click(screen.getByRole('button', { name: 'Start or continue chat' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);

    await user.click(usernameInput);
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(within(dialog).getByRole('button', { name: 'Encrypted' })).toHaveFocus();

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(within(dialog).getByRole('button', { name: 'Standard' })).toHaveFocus();

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(within(dialog).getByRole('button', { name: 'Group' })).toHaveFocus();

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(within(dialog).getByRole('button', { name: 'Direct' })).toHaveFocus();

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(within(dialog).getByRole('button', { name: 'Close new chat dialog' })).toHaveFocus();

    await user.keyboard('{Tab}');
    expect(within(dialog).getByRole('button', { name: 'Direct' })).toHaveFocus();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New chat' })).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  }, 10000);

  it('shows continuation pending and generic lookup failure copy', () => {
    const openerRef = { current: document.createElement('button') };

    render(
      <NewChatDialog
        isOpen
        username="missing.user"
        error="We could not start that chat. Check the username and try again."
        isSubmitting
        isGroupSubmitting={false}
        openerRef={openerRef}
        onUsernameChange={vi.fn()}
        onSubmit={vi.fn()}
        onCreateGroupSubmit={vi.fn()}
        onClearError={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Starting/ })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('We could not start that chat. Check the username and try again.');
  });

  it('adds username chips and submits a group conversation payload', async () => {
    const user = userEvent.setup();
    const onCreateGroupSubmit = vi.fn();

    render(
      <DialogHarness
        onSubmit={vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault())}
        onCreateGroupSubmit={onCreateGroupSubmit}
      />
    );

    await user.click(screen.getByRole('button', { name: 'New chat' }));
    await user.click(screen.getByRole('button', { name: 'Group' }));

    await user.type(screen.getByLabelText('Group name'), 'Project Relay');
    await user.type(screen.getByLabelText('Member username'), 'grace.hopper');
    await user.click(screen.getByRole('button', { name: 'Add group member' }));
    await user.type(screen.getByLabelText('Member username'), 'alan.turing');
    await user.keyboard('{Enter}');

    expect(screen.getByText('3/10 members')).toBeInTheDocument();
    expect(screen.getByText('grace.hopper')).toBeInTheDocument();
    expect(screen.getByText('alan.turing')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create group' }));

    expect(onCreateGroupSubmit).toHaveBeenCalledWith({
      chatName: 'Project Relay',
      memberUsernames: ['grace.hopper', 'alan.turing'],
    });
  });

  it('submits encrypted mode only when the user selects it', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>, options: DirectSubmitOptions) => {
      void options;
      event.preventDefault();
    });
    const onCreateGroupSubmit = vi.fn();

    render(
      <DialogHarness
        onSubmit={onSubmit}
        onCreateGroupSubmit={onCreateGroupSubmit}
      />
    );

    await user.click(screen.getByRole('button', { name: 'New chat' }));
    await user.click(screen.getByRole('button', { name: 'Encrypted' }));
    expect(screen.getByText(/This device stores the conversation secret/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Username'), 'encrypted.friend');
    await user.click(screen.getByRole('button', { name: 'Start or continue chat' }));

    expect(onSubmit.mock.calls[0][1]).toEqual({ encryptionMode: 'e2ee_v1' });

    await user.click(screen.getByRole('button', { name: 'Group' }));
    await user.type(screen.getByLabelText('Group name'), 'Encrypted Room');
    await user.type(screen.getByLabelText('Member username'), 'grace.hopper');
    await user.click(screen.getByRole('button', { name: 'Add group member' }));
    await user.type(screen.getByLabelText('Member username'), 'alan.turing');
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Create group' }));

    expect(onCreateGroupSubmit).toHaveBeenCalledWith({
      chatName: 'Encrypted Room',
      memberUsernames: ['grace.hopper', 'alan.turing'],
      encryptionMode: 'e2ee_v1',
    });
  });
});
