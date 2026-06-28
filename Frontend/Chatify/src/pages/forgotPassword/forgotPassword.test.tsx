import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useForgotPassword,
  useResetPassword,
  useVerifyResetCode,
} from '../../hooks/useAuthQuery';
import ForgotPassword from './forgotPassword';

vi.mock('../../hooks/useAuthQuery', () => ({
  useForgotPassword: vi.fn(),
  useVerifyResetCode: vi.fn(),
  useResetPassword: vi.fn(),
}));

const mockUseForgotPassword = vi.mocked(useForgotPassword);
const mockUseVerifyResetCode = vi.mocked(useVerifyResetCode);
const mockUseResetPassword = vi.mocked(useResetPassword);

describe('ForgotPassword', () => {
  beforeEach(() => {
    mockUseForgotPassword.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useForgotPassword>);
    mockUseVerifyResetCode.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useVerifyResetCode>);
    mockUseResetPassword.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useResetPassword>);
  });

  it('shows an app-level required email error before submitting reset requests', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();

    mockUseForgotPassword.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useForgotPassword>);

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Send Reset Code' }));

    expect(await screen.findByText('Email address is required.')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('shows an app-level invalid email error instead of relying on browser validation', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();

    mockUseForgotPassword.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useForgotPassword>);

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send Reset Code' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });
});
