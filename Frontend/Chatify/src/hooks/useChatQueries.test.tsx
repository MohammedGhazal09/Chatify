import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { messageApi } from '../api/messageApi';
import { useAuthStore } from '../store/authstore';
import { makeMessage, makeUser } from '../test/chatFixtures';
import {
  messageSearchQueryKey,
  messagesQueryKey,
  useMessageSearch,
} from './useChatQueries';

vi.mock('../api/messageApi', () => ({
  messageApi: {
    searchMessages: vi.fn(),
  },
}));

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useMessageSearch', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    useAuthStore.setState({
      user: makeUser(),
      isAuthenticated: true,
      isLoading: false,
    });
    vi.mocked(messageApi.searchMessages).mockResolvedValue({
      data: {
        status: 'messages searched successfully',
        data: {
          messages: [makeMessage({ _id: 'message-search', text: 'Search hit' })],
          query: 'search',
          limit: 25,
        },
      },
    } as Awaited<ReturnType<typeof messageApi.searchMessages>>);
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('suppresses searches below two trimmed characters', () => {
    const { result } = renderHook(() => useMessageSearch('chat-1', ' a '), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isBelowMinimum).toBe(true);
    expect(result.current.normalizedQuery).toBe('');
    expect(messageApi.searchMessages).not.toHaveBeenCalled();
  });

  it('debounces server search and keeps results out of the durable messages cache', async () => {
    const { result } = renderHook(() => useMessageSearch('chat-1', ' search '), {
      wrapper: createWrapper(queryClient),
    });

    expect(messageApi.searchMessages).not.toHaveBeenCalled();

    await new Promise((resolve) => {
      window.setTimeout(resolve, 250);
    });
    expect(messageApi.searchMessages).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(messageApi.searchMessages).toHaveBeenCalledWith('chat-1', {
        q: 'search',
        limit: 25,
      });
    });

    await waitFor(() => {
      expect(result.current.data?.[0]?.text).toBe('Search hit');
    });

    expect(queryClient.getQueryData(messageSearchQueryKey('chat-1', 'search'))).toEqual([
      expect.objectContaining({ _id: 'message-search' }),
    ]);
    expect(queryClient.getQueryData(messagesQueryKey('chat-1'))).toBeUndefined();
  });
});
