import { useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SpaceCreateDialog from './SpaceCreateDialog';

interface DialogHarnessProps {
  onSubmit: ComponentProps<typeof SpaceCreateDialog>['onSubmit'];
}

const DialogHarness = ({ onSubmit }: DialogHarnessProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={openerRef} type="button" onClick={() => setIsOpen(true)}>
        New space
      </button>
      <SpaceCreateDialog
        isOpen={isOpen}
        error={null}
        isSubmitting={false}
        openerRef={openerRef}
        onSubmit={onSubmit}
        onClearError={vi.fn()}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
};

describe('SpaceCreateDialog', () => {
  it('adds username chips and submits a create-space payload', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<DialogHarness onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'New space' }));
    await user.type(screen.getByLabelText('Space name'), ' Launch Room ');
    await user.type(screen.getByLabelText('Description'), ' Planning decisions ');
    await user.type(screen.getByLabelText('Member username'), 'grace.hopper');
    await user.click(screen.getByRole('button', { name: 'Add space member' }));
    await user.type(screen.getByLabelText('Member username'), 'alan.turing');
    await user.keyboard('{Enter}');

    expect(screen.getByText('3/25 members')).toBeInTheDocument();
    expect(screen.getByText('grace.hopper')).toBeInTheDocument();
    expect(screen.getByText('alan.turing')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create space' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Launch Room',
      description: 'Planning decisions',
      memberUsernames: ['grace.hopper', 'alan.turing'],
    });
  });

  it('rejects email-like member identifiers and keeps email copy out of the dialog', async () => {
    const user = userEvent.setup();

    render(<DialogHarness onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'New space' }));
    await user.type(screen.getByLabelText('Member username'), 'friend@example.com');
    await user.click(screen.getByRole('button', { name: 'Add space member' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Use valid member usernames.');
    expect(screen.queryByText(/email/i)).not.toBeInTheDocument();
  });

  it('requires a space name before submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<DialogHarness onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'New space' }));
    await user.click(screen.getByRole('button', { name: 'Create space' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a space name.');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
