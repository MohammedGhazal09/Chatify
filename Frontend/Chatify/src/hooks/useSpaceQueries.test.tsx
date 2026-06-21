import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { spaceApi } from '../api/spaceApi';
import { useAuthStore } from '../store/authstore';
import { makeSpace, makeSpaceChannel, makeUser } from '../test/chatFixtures';
import {
  spaceChannelsQueryKey,
  spacesQueryKey,
  useCreateSpace,
  useCreateSpaceChannel,
  useSpaceChannels,
  useSpaces,
} from './useSpaceQueries';

vi.mock('../api/spaceApi', () => ({
  spaceApi: {
    getSpaces: vi.fn(),
    getSpaceChannels: vi.fn(),
    createSpace: vi.fn(),
    createSpaceChannel: vi.fn(),
    addSpaceMember: vi.fn(),
    removeSpaceMember: vi.fn(),
  },
}));

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useSpaceQueries', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
    useAuthStore.setState({
      user: makeUser(),
      isAuthenticated: true,
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  it('loads authorized spaces and channels for the active account', async () => {
    const space = makeSpace();
    const channel = makeSpaceChannel();

    vi.mocked(spaceApi.getSpaces).mockResolvedValueOnce({
      data: { status: 'success', data: { spaces: [space] } },
    } as Awaited<ReturnType<typeof spaceApi.getSpaces>>);
    vi.mocked(spaceApi.getSpaceChannels).mockResolvedValueOnce({
      data: { status: 'success', data: { channels: [channel] } },
    } as Awaited<ReturnType<typeof spaceApi.getSpaceChannels>>);

    const spaces = renderHook(() => useSpaces(), { wrapper: createWrapper(queryClient) });
    const channels = renderHook(() => useSpaceChannels('space-1'), { wrapper: createWrapper(queryClient) });

    await waitFor(() => {
      expect(spaces.result.current.data?.[0]?.name).toBe('Launch Room');
      expect(channels.result.current.data?.[0]?.channelName).toBe('general');
    });

    expect(spaceApi.getSpaces).toHaveBeenCalledTimes(1);
    expect(spaceApi.getSpaceChannels).toHaveBeenCalledWith('space-1');
  });

  it('creates a space and caches its default channel', async () => {
    const channel = makeSpaceChannel({ _id: 'channel-created', channelName: 'general' });
    const space = makeSpace({
      _id: 'space-created',
      defaultChannelId: channel._id,
      channels: [],
    });

    vi.mocked(spaceApi.createSpace).mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          space,
          channel,
        },
      },
    } as Awaited<ReturnType<typeof spaceApi.createSpace>>);

    const { result } = renderHook(() => useCreateSpace(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'Launch Room',
        memberUsernames: ['grace.hopper'],
      });
    });

    expect(spaceApi.createSpace).toHaveBeenCalledWith({
      name: 'Launch Room',
      memberUsernames: ['grace.hopper'],
    });
    expect(queryClient.getQueryData(spacesQueryKey)).toEqual([
      expect.objectContaining({ _id: 'space-created' }),
    ]);
    expect(queryClient.getQueryData(spaceChannelsQueryKey('space-created'))).toEqual([
      expect.objectContaining({ _id: 'channel-created' }),
    ]);
  });

  it('creates a channel and appends it to the selected space cache', async () => {
    const existingChannel = makeSpaceChannel({ _id: 'channel-general', channelName: 'general' });
    const nextChannel = makeSpaceChannel({
      _id: 'channel-announcements',
      channelName: 'announcements',
      channelKey: 'announcements',
      channelDescription: 'Updates',
      createdAt: '2026-06-08T10:10:00.000Z',
    });

    queryClient.setQueryData(spaceChannelsQueryKey('space-1'), [existingChannel]);
    vi.mocked(spaceApi.createSpaceChannel).mockResolvedValueOnce({
      data: { status: 'success', data: { channel: nextChannel } },
    } as Awaited<ReturnType<typeof spaceApi.createSpaceChannel>>);

    const { result } = renderHook(() => useCreateSpaceChannel(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        spaceId: 'space-1',
        payload: { name: 'announcements', description: 'Updates' },
      });
    });

    expect(spaceApi.createSpaceChannel).toHaveBeenCalledWith('space-1', {
      name: 'announcements',
      description: 'Updates',
    });
    expect(queryClient.getQueryData(spaceChannelsQueryKey('space-1'))).toEqual([
      expect.objectContaining({ _id: 'channel-general' }),
      expect.objectContaining({ _id: 'channel-announcements' }),
    ]);
  });
});
