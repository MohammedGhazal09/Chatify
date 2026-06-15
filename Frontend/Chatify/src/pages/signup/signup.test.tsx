import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSignup } from '../../hooks/useAuthQuery';
import Signup from './signup';

vi.mock('../../hooks/useAuthQuery', () => ({
  useSignup: vi.fn(),
}));

vi.mock('../../api/apiOrigin', () => ({
  resolveOAuthUrl: vi.fn((provider: string) => `/api/auth/${provider}`),
}));

const mockUseSignup = vi.mocked(useSignup);

describe('Signup', () => {
  beforeEach(() => {
    mockUseSignup.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useSignup>);
  });

  it('submits signup details when Enter is pressed in the password field', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();

    mockUseSignup.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSignup>);

    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/first name/i), 'Ahmed');
    await user.type(screen.getByLabelText(/last name/i), 'Musa');
    await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Ahmed',
        lastName: 'Musa',
        email: 'user@example.com',
        password: 'password123',
      }),
      expect.objectContaining({ onError: expect.any(Function) })
    );
  });
});
