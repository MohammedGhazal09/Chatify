import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ChatStateView from './ChatStateView';

describe('ChatStateView', () => {
  it('renders state copy and calls visible actions', async () => {
    const user = userEvent.setup();
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();

    render(
      <ChatStateView
        heading="Your session expired"
        body="Sign in again to continue."
        primaryAction={{ label: 'Sign in', onClick: onPrimary }}
        secondaryAction={{ label: 'Dismiss', onClick: onSecondary }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Your session expired' })).toBeInTheDocument();
    expect(screen.getByText('Sign in again to continue.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });
});
