import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InviteLink } from '../../../types/invite';
import InviteLinksDialog from './InviteLinksDialog';

const hookMocks = vi.hoisted(() => ({
  useInviteLinks: vi.fn(),
  useCreateInviteLink: vi.fn(),
  useRevokeInviteLink: vi.fn(),
}));

vi.mock('../../../hooks/useInviteLinks', () => hookMocks);

let writeTextMock: ReturnType<typeof vi.fn>;

const activeInvite: InviteLink = {
  _id: 'invite-1',
  targetType: 'group',
  targetId: 'chat-1',
  expiresAt: '2026-07-07T08:00:00.000Z',
  maxUses: 5,
  useCount: 1,
  lastUsedAt: null,
  revokedAt: null,
  revokedBy: null,
  state: 'active',
  createdAt: '2026-06-30T08:00:00.000Z',
  updatedAt: '2026-06-30T08:00:00.000Z',
};

const renderDialog = (overrides: Partial<Parameters<typeof InviteLinksDialog>[0]> = {}) => {
  const createMutate = vi.fn((_variables, options?: { onSuccess?: (result: { invite: InviteLink; inviteUrl: string }) => void }) => {
    options?.onSuccess?.({
      invite: activeInvite,
      inviteUrl: 'https://chatify.test/invite/new-token',
    });
  });
  const revokeMutate = vi.fn();
  const refetch = vi.fn();

  hookMocks.useInviteLinks.mockReturnValue({
    data: [activeInvite],
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch,
  });
  hookMocks.useCreateInviteLink.mockReturnValue({
    mutate: createMutate,
    isPending: false,
    isError: false,
  });
  hookMocks.useRevokeInviteLink.mockReturnValue({
    mutate: revokeMutate,
    isPending: false,
  });

  render(
    <InviteLinksDialog
      isOpen
      targetType="group"
      targetId="chat-1"
      targetName="Product group"
      canManage
      disabledReason={null}
      onClose={vi.fn()}
      {...overrides}
    />
  );

  return { createMutate, revokeMutate, refetch };
};

describe('InviteLinksDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });
  });

  it('creates invite links with selected expiry and use limits', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });
    const { createMutate } = renderDialog();

    await user.click(screen.getByRole('button', { name: '30 days' }));
    await user.click(screen.getByRole('button', { name: '10 uses' }));
    await user.click(screen.getByRole('button', { name: 'Create invite link' }));

    expect(createMutate).toHaveBeenCalledWith(
      {
        targetType: 'group',
        targetId: 'chat-1',
        payload: {
          expiresInDays: 30,
          maxUses: 10,
        },
      },
      expect.any(Object)
    );
    expect(screen.getByText('https://chatify.test/invite/new-token')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeTextMock).toHaveBeenCalledWith('https://chatify.test/invite/new-token');
  });

  it('lists metadata-only invites and revokes active links', async () => {
    const user = userEvent.setup();
    const { revokeMutate } = renderDialog();

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('1 / 5 uses')).toBeInTheDocument();
    expect(screen.queryByText(/tokenHash/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Revoke invite link' }));
    expect(revokeMutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm revoke' }));

    expect(revokeMutate).toHaveBeenCalledWith({
      inviteId: 'invite-1',
      targetType: 'group',
      targetId: 'chat-1',
    }, expect.any(Object));
  });

  it('shows the management reason when the viewer cannot manage links', () => {
    renderDialog({
      canManage: false,
      disabledReason: 'Only the group admin can manage invite links.',
    });

    expect(screen.getByText('Only the group admin can manage invite links.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create invite link' })).not.toBeInTheDocument();
  });
});
