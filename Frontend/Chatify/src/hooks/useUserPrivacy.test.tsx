import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userApi } from '../api/userApi';
import {
  userPrivacySummaryQueryKey,
  useCancelAccountDeletion,
  useExportAccountData,
  useRequestAccountDeletion,
  useUserPrivacySummary,
} from './useUserPrivacy';

vi.mock('../api/userApi', () => ({
  userApi: {
    getPrivacySummary: vi.fn(),
    exportAccountData: vi.fn(),
    requestAccountDeletion: vi.fn(),
    cancelAccountDeletion: vi.fn(),
  },
}));

const mockUserApi = vi.mocked(userApi);

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const makeSummaryResponse = (deletionRequest = null) => ({
  data: {
    status: 'success',
    data: {
      exportVersion: '2026-06-21',
      deletionRequest,
      retentionSummary: {
        moderation: 'Abuse and security records may be retained.',
      },
    },
  },
} as unknown as Awaited<ReturnType<typeof userApi.getPrivacySummary>>);

const makeDeletionResponse = (status: 'pending' | 'canceled') => ({
  data: {
    status: 'success',
    data: {
      deletionRequest: {
        _id: 'deletion-1',
        type: 'account_deletion',
        status,
        requestedAt: '2026-06-21T00:00:00.000Z',
        scheduledFor: status === 'pending' ? '2026-07-05T00:00:00.000Z' : null,
        canceledAt: status === 'canceled' ? '2026-06-21T01:00:00.000Z' : null,
        retentionSummary: {
          moderation: 'Abuse and security records may be retained.',
        },
      },
      retentionSummary: {
        moderation: 'Abuse and security records may be retained.',
      },
    },
  },
} as unknown as Awaited<ReturnType<typeof userApi.requestAccountDeletion>>);

describe('useUserPrivacy', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
    mockUserApi.getPrivacySummary.mockResolvedValue(makeSummaryResponse());
    mockUserApi.exportAccountData.mockResolvedValue({
      data: {
        status: 'success',
        data: {
          export: {
            exportVersion: '2026-06-21',
            account: { username: 'privacy.user' },
          },
          audit: {
            _id: 'export-1',
            type: 'account_export',
            status: 'completed',
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof userApi.exportAccountData>>);
    mockUserApi.requestAccountDeletion.mockResolvedValue(makeDeletionResponse('pending'));
    mockUserApi.cancelAccountDeletion.mockResolvedValue(makeDeletionResponse('canceled'));
  });

  it('loads privacy summary only when enabled', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useUserPrivacySummary(enabled),
      {
        initialProps: { enabled: false },
        wrapper: createWrapper(queryClient),
      }
    );

    expect(mockUserApi.getPrivacySummary).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.data?.exportVersion).toBe('2026-06-21');
    });
    expect(mockUserApi.getPrivacySummary).toHaveBeenCalledTimes(1);
  });

  it('returns account export data without adding peer identifiers client-side', async () => {
    const { result } = renderHook(() => useExportAccountData(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      const response = await result.current.mutateAsync();
      expect(response.export).toMatchObject({
        exportVersion: '2026-06-21',
        account: { username: 'privacy.user' },
      });
    });

    expect(mockUserApi.exportAccountData).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mockUserApi.exportAccountData.mock.calls)).not.toContain('@');
  });

  it('invalidates the privacy summary after deletion request and cancellation', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const requestHook = renderHook(() => useRequestAccountDeletion(), {
      wrapper: createWrapper(queryClient),
    });
    const cancelHook = renderHook(() => useCancelAccountDeletion(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await requestHook.result.current.mutateAsync();
      await cancelHook.result.current.mutateAsync();
    });

    expect(mockUserApi.requestAccountDeletion).toHaveBeenCalledTimes(1);
    expect(mockUserApi.cancelAccountDeletion).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenNthCalledWith(1, { queryKey: userPrivacySummaryQueryKey });
    expect(invalidateSpy).toHaveBeenNthCalledWith(2, { queryKey: userPrivacySummaryQueryKey });
  });
});
