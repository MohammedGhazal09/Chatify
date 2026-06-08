import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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

    expect(screen.getByRole('dialog', { name: 'New chat' })).toBeInTheDocument();
    const emailInput = screen.getByLabelText('Email address');
    expect(emailInput).toHaveFocus();

    await user.type(emailInput, 'friend@example.com');
    await user.click(screen.getByRole('button', { name: 'Start chat' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New chat' })).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
