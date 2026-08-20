import type { ComponentProps } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeSpace, makeSpaceChannel } from '../../../test/chatFixtures';
import SpacesSidebar from './SpacesSidebar';

type SpacesSidebarProps = ComponentProps<typeof SpacesSidebar>;

const makeSpacesProps = (overrides: Partial<SpacesSidebarProps> = {}): SpacesSidebarProps => ({
  spaces: [],
  channels: [],
  selectedSpaceId: null,
  selectedChannelId: null,
  isSpacesLoading: false,
  isSpacesError: false,
  isChannelsLoading: false,
  isChannelsError: false,
  isCreatingSpace: false,
  isCreatingChannel: false,
  isJoiningSpace: false,
  createSpaceError: null,
  createChannelError: null,
  joinSpaceError: null,
  unreadCounts: new Map(),
  onSelectSpace: vi.fn(),
  onSelectChannel: vi.fn(),
  onCreateSpace: vi.fn(),
  onCreateChannel: vi.fn(),
  onJoinSpace: vi.fn(),
  onExitSpaces: vi.fn(),
  onClearCreateSpaceError: vi.fn(),
  onClearCreateChannelError: vi.fn(),
  onClearJoinSpaceError: vi.fn(),
  onRefetchSpaces: vi.fn(),
  onRefetchChannels: vi.fn(),
  ...overrides,
});

const renderSpacesSidebar = (overrides: Partial<SpacesSidebarProps> = {}) => {
  const props = makeSpacesProps(overrides);
  render(<SpacesSidebar {...props} />);
  return props;
};

describe('SpacesSidebar', () => {
  it('renders an empty spaces state and opens the create-space dialog', async () => {
    const user = userEvent.setup();

    renderSpacesSidebar();

    expect(screen.getByText('No spaces yet')).toBeInTheDocument();
    expect(screen.getByText('Create a private workspace, or join one with a code someone shared with you.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create a space' }));

    expect(screen.getByRole('dialog', { name: 'Create space' })).toBeInTheDocument();
  });

  it('opens the join-space dialog and submits a normalized join code', async () => {
    const user = userEvent.setup();
    const onJoinSpace = vi.fn();

    renderSpacesSidebar({ onJoinSpace });

    await user.click(screen.getByRole('button', { name: 'Join space' }));

    const dialog = screen.getByRole('dialog', { name: 'Join a space' });
    expect(dialog).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Join code'), 'abcd2345');
    await user.click(within(dialog).getByRole('button', { name: 'Join space' }));

    expect(onJoinSpace).toHaveBeenCalledWith({ joinCode: 'ABCD2345' });
  });

  it('lets users return to conversations from inside spaces', async () => {
    const user = userEvent.setup();
    const onExitSpaces = vi.fn();

    renderSpacesSidebar({
      spaces: [makeSpace()],
      selectedSpaceId: 'space-1',
      onExitSpaces,
    });

    await user.click(screen.getByRole('button', { name: 'Back to conversations' }));

    expect(onExitSpaces).toHaveBeenCalledTimes(1);
  });

  it('reveals the shareable join code with a copy control only to managers', () => {
    const manageableSpace = makeSpace({
      _id: 'space-managed',
      canManage: true,
      requesterRole: 'owner',
      joinCode: 'ABCD2345',
    });

    const { rerender } = render(
      <SpacesSidebar
        {...makeSpacesProps({
          spaces: [manageableSpace],
          selectedSpaceId: manageableSpace._id,
        })}
      />
    );

    expect(screen.getByText('ABCD2345')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy join code' })).toBeInTheDocument();

    const memberSpace = makeSpace({
      _id: 'space-member',
      canManage: false,
      requesterRole: 'member',
      joinCode: undefined,
    });

    rerender(
      <SpacesSidebar
        {...makeSpacesProps({
          spaces: [memberSpace],
          selectedSpaceId: memberSpace._id,
        })}
      />
    );

    expect(screen.queryByText('ABCD2345')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy join code' })).not.toBeInTheDocument();
  });

  it('selects spaces and channels without rendering member email fields', async () => {
    const user = userEvent.setup();
    const onSelectSpace = vi.fn();
    const onSelectChannel = vi.fn();
    const channel = makeSpaceChannel({
      _id: 'channel-general',
      channelName: 'general',
      channelDescription: 'Default channel',
    });
    const space = makeSpace({
      _id: 'space-1',
      name: 'Launch Room',
      memberCount: 2,
      channels: [channel],
    });

    renderSpacesSidebar({
      spaces: [space],
      channels: [channel],
      selectedSpaceId: space._id,
      selectedChannelId: null,
      unreadCounts: new Map([[channel._id, 4]]),
      onSelectSpace,
      onSelectChannel,
    });

    await user.click(screen.getByRole('button', { name: 'Select space Launch Room' }));
    await user.click(screen.getByRole('button', { name: 'Select channel general' }));

    expect(onSelectSpace).toHaveBeenCalledWith('space-1');
    expect(onSelectChannel).toHaveBeenCalledWith('channel-general');
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.queryByText(/email/i)).not.toBeInTheDocument();
  });

  it('shows create-channel controls only to users who can manage the space', () => {
    const channel = makeSpaceChannel();
    const manageableSpace = makeSpace({ canManage: true, requesterRole: 'admin' });
    const memberSpace = makeSpace({ canManage: false, requesterRole: 'member' });
    const props = makeSpacesProps({
      spaces: [manageableSpace],
      channels: [channel],
      selectedSpaceId: manageableSpace._id,
    });
    const { rerender } = render(<SpacesSidebar {...props} />);

    expect(screen.getByRole('button', { name: 'Create channel' })).toBeInTheDocument();

    rerender(
      <SpacesSidebar
        {...props}
        spaces={[memberSpace]}
        selectedSpaceId={memberSpace._id}
      />
    );

    expect(screen.queryByRole('button', { name: 'Create channel' })).not.toBeInTheDocument();
  });

  it('keeps long names truncated in stable list rows', () => {
    const longName = 'International Launch Coordination Room With Several Teams';
    const longChannelName = 'cross-functional-release-readiness';

    renderSpacesSidebar({
      spaces: [makeSpace({ name: longName })],
      channels: [makeSpaceChannel({ channelName: longChannelName, channelDescription: 'A very long but private channel description' })],
      selectedSpaceId: 'space-1',
    });

    expect(screen.getAllByText(longName)[0]).toHaveClass('truncate');
    expect(screen.getByText(longChannelName)).toHaveClass('truncate');
  });

  it('renders loading and access-denied channel states', () => {
    const { rerender } = render(
      <SpacesSidebar
        {...makeSpacesProps({
          spaces: [makeSpace()],
          selectedSpaceId: 'space-1',
          isChannelsLoading: true,
        })}
      />
    );

    expect(screen.getByLabelText('Loading channels')).toBeInTheDocument();

    rerender(
      <SpacesSidebar
        {...makeSpacesProps({
          spaces: [makeSpace()],
          selectedSpaceId: 'space-1',
          isChannelsError: true,
        })}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Channels unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent('You may no longer have access');
  });
});
