import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userApi } from '../api/userApi';
import { useAuthStore } from '../store/authstore';
import { makeUser } from '../test/chatFixtures';
import {
  chatsQueryKey,
  onlinePresenceQueryKey,
  userSearchQueryKey,
  usersQueryKey,
} from './useChatQueries';
import { authQueryKey, useProfileImageMutation } from './useProfileImageMutation';

vi.mock('../api/userApi', () => ({
  userApi: {
    uploadProfileImage: vi.fn(),
    removeProfileImage: vi.fn(),
  },
}));

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const makeResponse = (user: ReturnType<typeof makeUser>) => ({
  data: {
    status: 'success',
    data: {
      user,
    },
  },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
});

describe('useProfileImageMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: {
          retry: false,
        },
        queries: {
          retry: false,
        },
      },
    });
    useAuthStore.setState({
      user: makeUser({ profilePic: '/api/user/user-1/profile-image?v=old' }),
      isAuthenticated: true,
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  it('updates the auth store and invalidates identity-dependent queries after upload', async () => {
    const updatedUser = makeUser({ profilePic: '/api/user/user-1/profile-image?v=new' });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(userApi.uploadProfileImage).mockResolvedValue(
      makeResponse(updatedUser) as Awaited<ReturnType<typeof userApi.uploadProfileImage>>
    );

    const { result } = renderHook(() => useProfileImageMutation(), {
      wrapper: createWrapper(queryClient),
    });
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });

    await act(async () => {
      await result.current.uploadProfileImage.mutateAsync(file);
    });

    expect(userApi.uploadProfileImage).toHaveBeenCalledWith(file);
    expect(useAuthStore.getState().user?.profilePic).toBe('/api/user/user-1/profile-image?v=new');
    expect(queryClient.getQueryData(authQueryKey)).toMatchObject({
      profilePic: '/api/user/user-1/profile-image?v=new',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: authQueryKey });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: chatsQueryKey });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: onlinePresenceQueryKey });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: usersQueryKey });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: userSearchQueryKey });
  });

  it('updates the auth store after remove returns the provider or fallback image', async () => {
    const fallbackUser = makeUser({ profilePic: 'https://provider.test/avatar.png' });
    vi.mocked(userApi.removeProfileImage).mockResolvedValue(
      makeResponse(fallbackUser) as Awaited<ReturnType<typeof userApi.removeProfileImage>>
    );

    const { result } = renderHook(() => useProfileImageMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.removeProfileImage.mutateAsync();
    });

    expect(userApi.removeProfileImage).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user?.profilePic).toBe('https://provider.test/avatar.png');
    expect(queryClient.getQueryData(authQueryKey)).toMatchObject({
      profilePic: 'https://provider.test/avatar.png',
    });
  });

  it('leaves the previous current user image intact when upload fails', async () => {
    vi.mocked(userApi.uploadProfileImage).mockRejectedValue(new Error('upload failed'));

    const { result } = renderHook(() => useProfileImageMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(result.current.uploadProfileImage.mutateAsync(
      new File(['image'], 'avatar.png', { type: 'image/png' })
    )).rejects.toThrow('upload failed');

    expect(useAuthStore.getState().user?.profilePic).toBe('/api/user/user-1/profile-image?v=old');
    expect(queryClient.getQueryData(authQueryKey)).toBeUndefined();
  });
});
