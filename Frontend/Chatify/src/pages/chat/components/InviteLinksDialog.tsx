import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Check,
  Copy,
  Link2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import type {
  InviteExpiryDays,
  InviteLink,
  InviteMaxUses,
  InviteTargetType,
} from '../../../types/invite';
import {
  useCreateInviteLink,
  useInviteLinks,
  useRevokeInviteLink,
} from '../../../hooks/useInviteLinks';

interface InviteLinksDialogProps {
  isOpen: boolean;
  targetType: InviteTargetType;
  targetId: string;
  targetName: string;
  canManage: boolean;
  disabledReason?: string | null;
  onClose: () => void;
}

const EXPIRY_OPTIONS: InviteExpiryDays[] = [1, 7, 30];
const MAX_USE_OPTIONS: InviteMaxUses[] = [1, 5, 10, 'unlimited'];

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return 'Not used';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unavailable';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const getStateTone = (state: InviteLink['state']) => {
  if (state === 'active') {
    return 'success';
  }

  if (state === 'exhausted') {
    return 'warning';
  }

  return 'neutral';
};

const formatMaxUses = (value: InviteMaxUses | number | null) => (
  value === 'unlimited' || value === null ? 'Unlimited' : `${value} use${value === 1 ? '' : 's'}`
);

const formatState = (state: InviteLink['state']) => (
  state.charAt(0).toUpperCase() + state.slice(1)
);

const InviteLinksDialog = ({
  isOpen,
  targetType,
  targetId,
  targetName,
  canManage,
  disabledReason,
  onClose,
}: InviteLinksDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [expiresInDays, setExpiresInDays] = useState<InviteExpiryDays>(7);
  const [maxUses, setMaxUses] = useState<InviteMaxUses>(5);
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [confirmingInviteId, setConfirmingInviteId] = useState<string | null>(null);
  const inviteLinksQuery = useInviteLinks(targetType, targetId, isOpen && canManage);
  const createInviteLink = useCreateInviteLink();
  const revokeInviteLink = useRevokeInviteLink();
  const invites = inviteLinksQuery.data ?? [];
  const targetLabel = targetType === 'space' ? 'space' : 'group';
  const isBusy = createInviteLink.isPending || revokeInviteLink.isPending;

  useEffect(() => {
    if (!isOpen) {
      setLatestInviteUrl(null);
      setCopyState('idle');
      setConfirmingInviteId(null);
      return undefined;
    }

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!copyState || copyState === 'idle') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setCopyState('idle'), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

  if (!isOpen) {
    return null;
  }

  const createLink = () => {
    if (!canManage) {
      return;
    }

    createInviteLink.mutate(
      {
        targetType,
        targetId,
        payload: {
          expiresInDays,
          maxUses,
        },
      },
      {
        onSuccess: ({ inviteUrl }) => {
          setLatestInviteUrl(inviteUrl);
          setCopyState('idle');
        },
      }
    );
  };

  const copyLatestInvite = async () => {
    if (!latestInviteUrl) {
      return;
    }

    try {
      await navigator.clipboard?.writeText(latestInviteUrl);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const confirmRevokeInvite = (invite: InviteLink) => {
    revokeInviteLink.mutate(
      {
        inviteId: invite._id,
        targetType,
        targetId,
      },
      {
        onSuccess: () => {
          setConfirmingInviteId(null);
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close invite links dialog"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-links-title"
        className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-[var(--chat-radius-lg)] border border-[var(--chat-border)] bg-[var(--chat-panel)] text-[var(--chat-text)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--chat-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 id="invite-links-title" className="truncate text-base font-bold">
              Invite links
            </h2>
            <p className="mt-1 truncate text-sm text-[var(--chat-text-muted)]">
              {targetName} - {targetLabel}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label="Close invite links dialog"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {!canManage ? (
            <div className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] px-3 py-3 text-sm text-[var(--chat-text-muted)]" role="status">
              {disabledReason ?? 'Invite links are not available for this conversation.'}
            </div>
          ) : (
            <div className="space-y-5">
              <section className="space-y-4 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] p-4">
                <div>
                  <h3 className="text-sm font-bold">Create a link</h3>
                  <p className="mt-1 text-sm text-[var(--chat-text-muted)]">
                    The full token is shown only once after creation.
                  </p>
                </div>

                <SegmentedControl
                  label="Expires"
                  options={EXPIRY_OPTIONS}
                  value={expiresInDays}
                  getLabel={(value) => `${value} day${value === 1 ? '' : 's'}`}
                  onChange={setExpiresInDays}
                />

                <SegmentedControl
                  label="Max uses"
                  options={MAX_USE_OPTIONS}
                  value={maxUses}
                  getLabel={formatMaxUses}
                  onChange={setMaxUses}
                />

                <button
                  type="button"
                  onClick={createLink}
                  disabled={createInviteLink.isPending}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-3 py-2 text-sm font-semibold text-[var(--chat-own-text)] transition-colors hover:bg-[var(--chat-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                >
                  {createInviteLink.isPending ? (
                    <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
                  ) : (
                    <Plus aria-hidden="true" className="h-4 w-4" />
                  )}
                  Create invite link
                </button>

                {latestInviteUrl ? (
                  <div className="rounded-[var(--chat-radius-md)] border border-[color-mix(in_srgb,var(--chat-success)_35%,var(--chat-border))] bg-[color-mix(in_srgb,var(--chat-success)_8%,var(--chat-panel))] p-3">
                    <p className="text-xs font-semibold uppercase text-[var(--chat-text-soft)]">New link</p>
                    <div className="mt-2 flex min-w-0 items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded-[var(--chat-radius-md)] bg-[var(--chat-input-bg)] px-2 py-2 text-xs text-[var(--chat-text)]">
                        {latestInviteUrl}
                      </code>
                      <button
                        type="button"
                        onClick={copyLatestInvite}
                        className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-2.5 py-1 text-xs font-semibold text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                      >
                        {copyState === 'copied' ? (
                          <Check aria-hidden="true" className="h-3.5 w-3.5" />
                        ) : (
                          <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                        )}
                        {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Failed' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {createInviteLink.isError ? (
                  <p className="text-sm text-[var(--chat-danger)]" role="alert">
                    Could not create invite link.
                  </p>
                ) : null}
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold">Existing links</h3>
                  <button
                    type="button"
                    onClick={() => inviteLinksQuery.refetch()}
                    disabled={inviteLinksQuery.isFetching}
                    className="grid h-8 w-8 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                    aria-label="Refresh invite links"
                    title="Refresh invite links"
                  >
                    <RefreshCw
                      aria-hidden="true"
                      className={`h-4 w-4 ${inviteLinksQuery.isFetching ? 'motion-safe:animate-spin' : ''}`}
                    />
                  </button>
                </div>

                {inviteLinksQuery.isLoading ? (
                  <StateBox>Loading invite links</StateBox>
                ) : inviteLinksQuery.isError ? (
                  <StateBox tone="danger">Invite links unavailable</StateBox>
                ) : invites.length === 0 ? (
                  <StateBox>No invite links yet</StateBox>
                ) : (
                  <div className="space-y-2">
                    {invites.map((invite) => (
                      <InviteLinkRow
                        key={invite._id}
                        invite={invite}
                        isRevoking={isBusy}
                        isConfirming={confirmingInviteId === invite._id}
                        onRequestRevoke={(nextInvite) => setConfirmingInviteId(nextInvite._id)}
                        onCancelRevoke={() => setConfirmingInviteId(null)}
                        onConfirmRevoke={confirmRevokeInvite}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SegmentedControl = <T extends InviteExpiryDays | InviteMaxUses>({
  label,
  options,
  value,
  getLabel,
  onChange,
}: {
  label: string;
  options: T[];
  value: T;
  getLabel: (value: T) => string;
  onChange: (value: T) => void;
}) => (
  <div className="space-y-2">
    <p className="text-xs font-semibold text-[var(--chat-text-muted)]">{label}</p>
    <div className="grid grid-cols-4 gap-2" role="group" aria-label={label}>
      {options.map((option) => {
        const selected = option === value;

        return (
          <button
            key={String(option)}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option)}
            className={`min-h-9 rounded-[var(--chat-radius-md)] border px-2 py-1.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
              selected
                ? 'border-[var(--chat-accent)] bg-[var(--chat-accent-soft)] text-[var(--chat-accent)]'
                : 'border-[var(--chat-border)] bg-[var(--chat-panel)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)]'
            }`}
          >
            {getLabel(option)}
          </button>
        );
      })}
    </div>
  </div>
);

const InviteLinkRow = ({
  invite,
  isRevoking,
  isConfirming,
  onRequestRevoke,
  onCancelRevoke,
  onConfirmRevoke,
}: {
  invite: InviteLink;
  isRevoking: boolean;
  isConfirming: boolean;
  onRequestRevoke: (invite: InviteLink) => void;
  onCancelRevoke: () => void;
  onConfirmRevoke: (invite: InviteLink) => void;
}) => {
  const stateTone = getStateTone(invite.state);
  const canRevoke = invite.state !== 'revoked';

  return (
    <div className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] px-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel-subtle)] text-[var(--chat-accent)]">
          <Link2 aria-hidden="true" className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatePill tone={stateTone}>{formatState(invite.state)}</StatePill>
            <span className="text-xs text-[var(--chat-text-muted)]">
              {invite.useCount} / {formatMaxUses(invite.maxUses)}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-[var(--chat-text)]">
            Expires {formatDateTime(invite.expiresAt)}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--chat-text-muted)]">
            Last used {formatDateTime(invite.lastUsedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRequestRevoke(invite)}
          disabled={!canRevoke || isRevoking}
          className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[color-mix(in_srgb,var(--chat-danger)_10%,var(--chat-panel-subtle))] hover:text-[var(--chat-danger)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          aria-label="Revoke invite link"
          title={canRevoke ? 'Revoke invite link' : 'Invite link already revoked'}
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      {isConfirming ? (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--chat-border)] pt-3">
          <p className="mr-auto text-xs text-[var(--chat-text-muted)]">Revoke this invite link?</p>
          <button
            type="button"
            onClick={onCancelRevoke}
            className="min-h-8 cursor-pointer rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-2.5 py-1 text-xs font-semibold text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirmRevoke(invite)}
            disabled={isRevoking}
            className="min-h-8 cursor-pointer rounded-[var(--chat-radius-md)] bg-[var(--chat-danger)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[color-mix(in_srgb,var(--chat-danger)_86%,black)] disabled:cursor-not-allowed disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          >
            Confirm revoke
          </button>
        </div>
      ) : null}
    </div>
  );
};

const StatePill = ({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'neutral';
  children: ReactNode;
}) => (
  <span
    className={`inline-flex min-h-6 items-center rounded-full px-2 text-xs font-bold ${
      tone === 'success'
        ? 'bg-[color-mix(in_srgb,var(--chat-success)_14%,var(--chat-panel))] text-[var(--chat-success)]'
        : tone === 'warning'
          ? 'bg-[color-mix(in_srgb,var(--chat-warning)_14%,var(--chat-panel))] text-[var(--chat-warning)]'
          : 'bg-[var(--chat-panel-subtle)] text-[var(--chat-text-muted)]'
    }`}
  >
    {children}
  </span>
);

const StateBox = ({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'danger';
}) => (
  <p
    className={`rounded-[var(--chat-radius-md)] border border-dashed px-3 py-3 text-sm ${
      tone === 'danger'
        ? 'border-[color-mix(in_srgb,var(--chat-danger)_45%,var(--chat-border))] bg-[color-mix(in_srgb,var(--chat-danger)_8%,var(--chat-panel))] text-[var(--chat-danger)]'
        : 'border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] text-[var(--chat-text-muted)]'
    }`}
  >
    {children}
  </p>
);

export default InviteLinksDialog;
