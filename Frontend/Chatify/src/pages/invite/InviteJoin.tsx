import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { useJoinInviteLink } from '../../hooks/useInviteLinks';
import type { JoinInviteLinkResult } from '../../types/invite';

const getSpaceDefaultChannelId = (result: Extract<JoinInviteLinkResult, { targetType: 'space' }>) => {
  const { space } = result;
  return (
    space.channels?.find((channel) => (
      channel._id === space.defaultChannelId ||
      channel._id === space.defaultChannel
    ))?._id ??
    space.channels?.[0]?._id ??
    null
  );
};

const buildRedirectPath = (result: JoinInviteLinkResult) => {
  if (result.targetType === 'group') {
    return `/?chatId=${encodeURIComponent(result.chat._id)}`;
  }

  const channelId = getSpaceDefaultChannelId(result);
  const params = new URLSearchParams({
    workspace: 'spaces',
    spaceId: result.space._id,
  });

  if (channelId) {
    params.set('chatId', channelId);
  }

  return `/?${params.toString()}`;
};

const InviteJoin = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const {
    mutate: joinInvite,
    isPending,
    isSuccess,
    isError,
  } = useJoinInviteLink();
  const decodedToken = token ? decodeURIComponent(token) : '';

  useEffect(() => {
    if (!decodedToken || isPending || isSuccess || isError) {
      return;
    }

    joinInvite(decodedToken, {
      onSuccess: (result) => {
        navigate(buildRedirectPath(result), { replace: true });
      },
    });
  }, [decodedToken, isError, isPending, isSuccess, joinInvite, navigate]);

  const retryJoin = () => {
    if (!decodedToken) {
      return;
    }

    joinInvite(decodedToken, {
      onSuccess: (result) => {
        navigate(buildRedirectPath(result), { replace: true });
      },
    });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--chat-bg,#0f172a)] px-4 py-8 text-[var(--chat-text,#f8fafc)]">
      <section className="w-full max-w-md rounded-[var(--chat-radius-lg,12px)] border border-[var(--chat-border,rgba(148,163,184,0.28))] bg-[var(--chat-panel,#111827)] p-6 shadow-2xl">
        <h1 className="text-xl font-bold">Joining invite</h1>
        {!decodedToken ? (
          <InviteState
            title="Invite link unavailable"
            copy="This invite link is missing its token."
            action={<BackToChats />}
          />
        ) : isError ? (
          <InviteState
            title="Invite unavailable"
            copy="This invite may be expired, revoked, full, or no longer valid."
            action={(
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={retryJoin}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--chat-radius-md,8px)] bg-[var(--chat-accent,#2563eb)] px-3 py-2 text-sm font-semibold text-[var(--chat-own-text,#fff)] hover:bg-[var(--chat-accent-strong,#1d4ed8)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus,#60a5fa)]"
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Retry
                </button>
                <BackToChats />
              </div>
            )}
          />
        ) : (
          <InviteState
            title="Checking access"
            copy="We are validating this invite and opening the conversation."
            action={(
              <span className="inline-flex items-center gap-2 text-sm text-[var(--chat-text-muted,#cbd5e1)]">
                <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
                Joining
              </span>
            )}
          />
        )}
      </section>
    </main>
  );
};

const InviteState = ({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action: ReactNode;
}) => (
  <div className="mt-4 space-y-4">
    <div>
      <p className="font-semibold text-[var(--chat-text,#f8fafc)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--chat-text-muted,#cbd5e1)]">{copy}</p>
    </div>
    {action}
  </div>
);

const BackToChats = () => (
  <Link
    to="/"
    className="inline-flex min-h-10 items-center rounded-[var(--chat-radius-md,8px)] border border-[var(--chat-border,rgba(148,163,184,0.28))] px-3 py-2 text-sm font-semibold text-[var(--chat-text-muted,#cbd5e1)] hover:bg-[var(--chat-panel-subtle,rgba(148,163,184,0.12))] hover:text-[var(--chat-text,#f8fafc)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus,#60a5fa)]"
  >
    Back to chats
  </Link>
);

export default InviteJoin;
