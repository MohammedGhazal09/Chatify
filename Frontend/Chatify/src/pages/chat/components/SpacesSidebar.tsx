import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Hash,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { CreateSpaceChannelPayload, CreateSpacePayload, Space, SpaceChannel } from '../../../types/space';
import ChannelCreateDialog from './ChannelCreateDialog';
import SpaceCreateDialog from './SpaceCreateDialog';

interface SpacesSidebarProps {
  spaces: Space[] | undefined;
  channels: SpaceChannel[] | undefined;
  selectedSpaceId: string | null;
  selectedChannelId: string | null;
  isSpacesLoading: boolean;
  isSpacesError: boolean;
  isChannelsLoading: boolean;
  isChannelsError: boolean;
  isCreatingSpace: boolean;
  isCreatingChannel: boolean;
  createSpaceError: string | null;
  createChannelError: string | null;
  unreadCounts?: Map<string, number>;
  onSelectSpace: (spaceId: string) => void;
  onSelectChannel: (channelId: string) => void;
  onCreateSpace: (payload: CreateSpacePayload) => void;
  onCreateChannel: (payload: CreateSpaceChannelPayload) => void;
  onClearCreateSpaceError: () => void;
  onClearCreateChannelError: () => void;
  onRefetchSpaces: () => void;
  onRefetchChannels: () => void;
}

const formatRole = (role: Space['requesterRole']) => {
  if (role === 'owner') {
    return 'Owner';
  }

  if (role === 'admin') {
    return 'Admin';
  }

  return 'Member';
};

const SpacesListSkeleton = () => (
  <div className="space-y-2 p-3" aria-label="Loading spaces">
    {[0, 1, 2].map((item) => (
      <div key={item} className="space-y-2 rounded-[var(--chat-radius-md)] px-3 py-2">
        <div className={`h-3 motion-safe:animate-pulse rounded bg-[var(--chat-panel-subtle)] ${item === 0 ? 'w-36' : 'w-28'}`} />
        <div className="h-3 w-44 motion-safe:animate-pulse rounded bg-[var(--chat-panel-subtle)]" />
      </div>
    ))}
  </div>
);

const ChannelListSkeleton = () => (
  <div className="space-y-1 p-2" aria-label="Loading channels">
    {[0, 1, 2].map((item) => (
      <div key={item} className="flex min-h-10 items-center gap-2 rounded-[var(--chat-radius-md)] px-3">
        <div className="h-4 w-4 motion-safe:animate-pulse rounded bg-[var(--chat-panel-subtle)]" />
        <div className={`h-3 motion-safe:animate-pulse rounded bg-[var(--chat-panel-subtle)] ${item === 0 ? 'w-32' : 'w-24'}`} />
      </div>
    ))}
  </div>
);

const SpacesSidebar = ({
  spaces,
  channels,
  selectedSpaceId,
  selectedChannelId,
  isSpacesLoading,
  isSpacesError,
  isChannelsLoading,
  isChannelsError,
  isCreatingSpace,
  isCreatingChannel,
  createSpaceError,
  createChannelError,
  unreadCounts,
  onSelectSpace,
  onSelectChannel,
  onCreateSpace,
  onCreateChannel,
  onClearCreateSpaceError,
  onClearCreateChannelError,
  onRefetchSpaces,
  onRefetchChannels,
}: SpacesSidebarProps) => {
  const createSpaceButtonRef = useRef<HTMLButtonElement>(null);
  const createChannelButtonRef = useRef<HTMLButtonElement>(null);
  const wasCreatingSpaceRef = useRef(false);
  const wasCreatingChannelRef = useRef(false);
  const [isCreateSpaceOpen, setIsCreateSpaceOpen] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const selectedSpace = useMemo(
    () => spaces?.find((space) => space._id === selectedSpaceId) ?? null,
    [selectedSpaceId, spaces]
  );

  useEffect(() => {
    if (wasCreatingSpaceRef.current && !isCreatingSpace && !createSpaceError) {
      setIsCreateSpaceOpen(false);
    }

    wasCreatingSpaceRef.current = isCreatingSpace;
  }, [createSpaceError, isCreatingSpace]);

  useEffect(() => {
    if (wasCreatingChannelRef.current && !isCreatingChannel && !createChannelError) {
      setIsCreateChannelOpen(false);
    }

    wasCreatingChannelRef.current = isCreatingChannel;
  }, [createChannelError, isCreatingChannel]);

  const closeCreateSpace = () => {
    setIsCreateSpaceOpen(false);
    onClearCreateSpaceError();
  };

  const closeCreateChannel = () => {
    setIsCreateChannelOpen(false);
    onClearCreateChannelError();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--chat-border)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--chat-text-muted)]">Spaces</h2>
          <p className="truncate text-xs text-[var(--chat-text-soft)]">Private workrooms and channels</p>
        </div>
        <button
          ref={createSpaceButtonRef}
          type="button"
          onClick={() => setIsCreateSpaceOpen(true)}
          className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          aria-label="Create space"
          title="Create space"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-[var(--chat-border)]">
        {isSpacesLoading ? (
          <SpacesListSkeleton />
        ) : isSpacesError ? (
          <div className="space-y-3 p-4 text-sm text-[var(--chat-danger)]" role="alert">
            <div>
              <p className="font-semibold text-[var(--chat-text)]">Spaces unavailable</p>
              <p className="mt-1 text-[var(--chat-danger)]">We could not load your workspace list.</p>
            </div>
            <button
              type="button"
              onClick={onRefetchSpaces}
              className="inline-flex min-h-9 items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent-soft)] px-3 py-1 text-sm font-semibold text-[var(--chat-accent)] hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Try again
            </button>
          </div>
        ) : spaces && spaces.length > 0 ? (
          <ul className="max-h-[220px] space-y-1 overflow-y-auto p-2 chat-sidebar-scroll" aria-label="Spaces">
            {spaces.map((space) => {
              const isActive = space._id === selectedSpaceId;

              return (
                <li key={space._id}>
                  <button
                    type="button"
                    onClick={() => onSelectSpace(space._id)}
                    aria-pressed={isActive}
                    className={`flex min-h-[64px] w-full cursor-pointer items-center gap-3 rounded-[var(--chat-radius-md)] px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
                      isActive
                        ? 'bg-[var(--chat-active)] text-[var(--chat-active-text)]'
                        : 'text-[var(--chat-text)] hover:bg-[var(--chat-panel-subtle)]'
                    }`}
                    aria-label={`Select space ${space.name}`}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-accent-soft)] text-[var(--chat-accent)]">
                      <Users aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{space.name}</span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-[var(--chat-text-muted)]">
                        <span className="truncate">{space.memberCount} members</span>
                        <span aria-hidden="true">.</span>
                        <span className="truncate">{formatRole(space.requesterRole)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex min-h-[190px] flex-col items-center justify-center gap-3 p-4 text-center text-sm text-[var(--chat-text-muted)]" role="status">
            <div className="space-y-1">
              <p className="font-semibold text-[var(--chat-text)]">No spaces yet</p>
              <p className="max-w-[240px]">Create a private workspace when a conversation needs channels.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateSpaceOpen(true)}
              className="min-h-9 cursor-pointer rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--chat-accent)] hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            >
              Create a space
            </button>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--chat-border)] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--chat-text)]">
              {selectedSpace ? selectedSpace.name : 'Channels'}
            </p>
            {selectedSpace ? (
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-[var(--chat-text-muted)]">
                {selectedSpace.canManage ? <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" /> : null}
                {formatRole(selectedSpace.requesterRole)}
              </p>
            ) : (
              <p className="text-xs text-[var(--chat-text-soft)]">Select a space</p>
            )}
          </div>
          {selectedSpace?.canManage ? (
            <button
              ref={createChannelButtonRef}
              type="button"
              onClick={() => setIsCreateChannelOpen(true)}
              className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
              aria-label="Create channel"
              title="Create channel"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto chat-sidebar-scroll">
          {!selectedSpace ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-[var(--chat-text-muted)]" role="status">
              <p className="font-semibold text-[var(--chat-text)]">Choose a space</p>
              <p className="max-w-[220px]">Channels appear after you pick a workspace.</p>
            </div>
          ) : isChannelsLoading ? (
            <ChannelListSkeleton />
          ) : isChannelsError ? (
            <div className="space-y-3 p-4 text-sm text-[var(--chat-danger)]" role="alert">
              <div>
                <p className="font-semibold text-[var(--chat-text)]">Channels unavailable</p>
                <p className="mt-1 text-[var(--chat-danger)]">You may no longer have access, or the channel list failed to load.</p>
              </div>
              <button
                type="button"
                onClick={onRefetchChannels}
                className="inline-flex min-h-9 items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent-soft)] px-3 py-1 text-sm font-semibold text-[var(--chat-accent)] hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : channels && channels.length > 0 ? (
            <ul className="space-y-1 p-2" aria-label="Space channels">
              {channels.map((channel) => {
                const unreadCount = unreadCounts?.get(channel._id) ?? 0;
                const isActive = selectedChannelId === channel._id;

                return (
                  <li key={channel._id}>
                    <button
                      type="button"
                      onClick={() => onSelectChannel(channel._id)}
                      aria-pressed={isActive}
                      className={`flex min-h-[52px] w-full cursor-pointer items-center gap-3 rounded-[var(--chat-radius-md)] px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
                        isActive
                          ? 'bg-[var(--chat-active)] text-[var(--chat-active-text)]'
                          : 'text-[var(--chat-text)] hover:bg-[var(--chat-panel-subtle)]'
                      }`}
                      aria-label={`Select channel ${channel.channelName}`}
                    >
                      <Hash aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--chat-text-muted)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{channel.channelName}</span>
                        {channel.channelDescription ? (
                          <span className="mt-0.5 block truncate text-xs text-[var(--chat-text-muted)]">{channel.channelDescription}</span>
                        ) : null}
                      </span>
                      {unreadCount > 0 ? (
                        <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-[var(--chat-accent)] px-1.5 text-xs font-bold text-[var(--chat-own-text)]">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm text-[var(--chat-text-muted)]" role="status">
              <div className="space-y-1">
                <p className="font-semibold text-[var(--chat-text)]">No channels yet</p>
                <p className="max-w-[220px]">Create a channel to start organizing this space.</p>
              </div>
              {selectedSpace.canManage ? (
                <button
                  type="button"
                  onClick={() => setIsCreateChannelOpen(true)}
                  className="min-h-9 cursor-pointer rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--chat-accent)] hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                >
                  Create a channel
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <SpaceCreateDialog
        isOpen={isCreateSpaceOpen}
        error={createSpaceError}
        isSubmitting={isCreatingSpace}
        openerRef={createSpaceButtonRef}
        onSubmit={onCreateSpace}
        onClearError={onClearCreateSpaceError}
        onClose={closeCreateSpace}
      />
      <ChannelCreateDialog
        isOpen={isCreateChannelOpen}
        error={createChannelError}
        isSubmitting={isCreatingChannel}
        openerRef={createChannelButtonRef}
        onSubmit={onCreateChannel}
        onClearError={onClearCreateChannelError}
        onClose={closeCreateChannel}
      />
    </div>
  );
};

export default SpacesSidebar;
