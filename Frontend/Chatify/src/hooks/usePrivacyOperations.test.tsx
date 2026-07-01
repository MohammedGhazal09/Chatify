import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { privacyOperationsApi, type PrivacyOperationsPayload } from '../api/privacyOperationsApi';
import { useAuthStore } from '../store/authstore';
import { makeUser } from '../test/chatFixtures';
import { usePrivacyOperations } from './usePrivacyOperations';

vi.mock('../api/privacyOperationsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/privacyOperationsApi')>();

  return {
    ...actual,
    privacyOperationsApi: {
      getPrivacyOperations: vi.fn(),
    },
  };
});

const mockedPrivacyOperationsApi = vi.mocked(privacyOperationsApi);

const privacyOperations: PrivacyOperationsPayload = {
  generatedAt: '2026-07-01T09:00:00.000Z',
  status: 'attention',
  deletionRequests: {
    pending: 2,
    due: 1,
    completed: 4,
  },
  retention: {
    cleanupBacklog: 3,
    notificationOutboxRetentionDays: 30,
    expiredExportAudits: 1,
    expiredPasswordResets: 1,
    expiredSessions: 0,
    terminalNotificationOutbox: 1,
  },
  worker: {
    enabled: true,
    intervalMs: 300000,
    batchSize: 25,
    lastRun: null,
  },
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('usePrivacyOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
    mockedPrivacyOperationsApi.getPrivacyOperations.mockResolvedValue({
      data: {
        status: 'success',
        data: {
          privacyOperations,
        },
      },
    } as unknown as Awaited<ReturnType<typeof privacyOperationsApi.getPrivacyOperations>>);
  });

  it('loads privacy operations for admins', async () => {
    useAuthStore.setState({
      user: makeUser({ role: 'admin' }),
      isAuthenticated: true,
      isLoading: false,
    });

    const { result } = renderHook(() => usePrivacyOperations(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toEqual(privacyOperations));
    expect(mockedPrivacyOperationsApi.getPrivacyOperations).toHaveBeenCalledTimes(1);
  });

  it('does not call the diagnostics API for non-admin users', () => {
    useAuthStore.setState({
      user: makeUser({ role: 'user' }),
      isAuthenticated: true,
      isLoading: false,
    });

    const { result } = renderHook(() => usePrivacyOperations(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedPrivacyOperationsApi.getPrivacyOperations).not.toHaveBeenCalled();
  });
});
