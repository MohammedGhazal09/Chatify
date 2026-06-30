import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLogin, useVerifyTwoFactorLogin } from '../../hooks/useAuthQuery';
import Login from './login';

vi.mock('../../hooks/useAuthQuery', () => ({
  useLogin: vi.fn(),
  useVerifyTwoFactorLogin: vi.fn(),
}));

vi.mock('../../api/apiOrigin', () => ({
  resolveOAuthUrl: vi.fn((provider: string) => `/api/auth/${provider}`),
}));

const mockUseLogin = vi.mocked(useLogin);
const mockUseVerifyTwoFactorLogin = vi.mocked(useVerifyTwoFactorLogin);

describe('Login', () => {
  beforeEach(() => {
    mockUseLogin.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useLogin>);
    mockUseVerifyTwoFactorLogin.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useVerifyTwoFactorLogin>);
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

  it('switches to the two-factor challenge after password verification requires MFA', async () => {
    const user = userEvent.setup();
    const verifyMutate = vi.fn();

    mockUseLogin.mockReturnValue({
      mutate: vi.fn((
        _data: unknown,
        options?: {
          onSuccess?: (response: {
            data: {
              status: 'mfa_required';
              message: string;
              data: {
                twoFactorRequired: true;
                challengeToken: string;
                expiresAt: string;
              };
            };
          }) => void;
        }
      ) => {
        options?.onSuccess?.({
          data: {
            status: 'mfa_required',
            message: 'Two-factor verification required',
            data: {
              twoFactorRequired: true,
              challengeToken: 'challenge-token',
              expiresAt: '2026-06-30T08:00:00.000Z',
            },
          },
        });
      }),
      isPending: false,
    } as unknown as ReturnType<typeof useLogin>);
    mockUseVerifyTwoFactorLogin.mockReturnValue({
      mutate: verifyMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useVerifyTwoFactorLogin>);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: /two-factor verification/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/verification code/i), '123456');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));

    expect(verifyMutate).toHaveBeenCalledWith(
      {
        challengeToken: 'challenge-token',
        code: '123456',
      },
      expect.objectContaining({ onError: expect.any(Function) })
    );
  });
});
