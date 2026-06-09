import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import NewChatDialog from './NewChatDialog';

interface DialogHarnessProps {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

const DialogHarness = ({ onSubmit }: DialogHarnessProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const openerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={openerRef} type="button" onClick={() => setIsOpen(true)}>
        New chat
      </button>
      <NewChatDialog
        isOpen={isOpen}
        email={email}
        error={null}
        isSubmitting={false}
        openerRef={openerRef}
        onEmailChange={setEmail}
        onSubmit={onSubmit}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
};

describe('NewChatDialog', () => {
  it('uses dialog semantics, submits email, and returns focus after Escape close', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());

    render(<DialogHarness onSubmit={onSubmit} />);

    const opener = screen.getByRole('button', { name: 'New chat' });
    await user.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'New chat' });
    expect(dialog).toBeInTheDocument();
    const emailInput = screen.getByLabelText('Email address');
    expect(emailInput).toHaveFocus();
    expect(emailInput).toHaveAttribute('name', 'targetEmail');

    await user.type(emailInput, 'friend@example.com');
    await user.click(screen.getByRole('button', { name: 'Start or continue chat' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);

    await user.click(emailInput);
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(within(dialog).getByRole('button', { name: 'Close new chat dialog' })).toHaveFocus();

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(within(dialog).getByRole('button', { name: 'Start or continue chat' })).toHaveFocus();

    await user.keyboard('{Tab}');
    expect(within(dialog).getByRole('button', { name: 'Close new chat dialog' })).toHaveFocus();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New chat' })).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('shows continuation pending and generic lookup failure copy', () => {
    const openerRef = { current: document.createElement('button') };

    render(
      <NewChatDialog
        isOpen
        email="missing@example.com"
        error="We could not start that chat. Check the email and try again."
        isSubmitting
        openerRef={openerRef}
        onEmailChange={vi.fn()}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Starting/ })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('We could not start that chat. Check the email and try again.');
  });
});
