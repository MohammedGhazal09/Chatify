import { useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SpaceJoinDialog from './SpaceJoinDialog';

interface DialogHarnessProps {
  onSubmit: ComponentProps<typeof SpaceJoinDialog>['onSubmit'];
}

const DialogHarness = ({ onSubmit }: DialogHarnessProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={openerRef} type="button" onClick={() => setIsOpen(true)}>
        Open join dialog
      </button>
      <SpaceJoinDialog
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

describe('SpaceJoinDialog', () => {
  it('normalizes and submits a join code', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<DialogHarness onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Open join dialog' }));
    await user.type(screen.getByLabelText('Join code'), 'abcd2345');
    await user.click(screen.getByRole('button', { name: 'Join space' }));

    expect(onSubmit).toHaveBeenCalledWith({ joinCode: 'ABCD2345' });
  });

  it('rejects an incomplete join code', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<DialogHarness onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Open join dialog' }));
    await user.type(screen.getByLabelText('Join code'), 'ABC');
    await user.click(screen.getByRole('button', { name: 'Join space' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid join code.');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
