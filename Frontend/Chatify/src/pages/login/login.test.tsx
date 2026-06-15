import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLogin } from '../../hooks/useAuthQuery';
import Login from './login';

vi.mock('../../hooks/useAuthQuery', () => ({
  useLogin: vi.fn(),
}));

vi.mock('../../api/apiOrigin', () => ({
  resolveOAuthUrl: vi.fn((provider: string) => `/api/auth/${provider}`),
}));

const mockUseLogin = vi.mocked(useLogin);

describe('Login', () => {
  beforeEach(() => {
    mockUseLogin.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useLogin>);
  });

  it('submits login credentials when Enter is pressed in the password field', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();

    mockUseLogin.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useLogin>);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        password: 'password123',
      }),
      expect.objectContaining({ onError: expect.any(Function) })
    );
  });
});
