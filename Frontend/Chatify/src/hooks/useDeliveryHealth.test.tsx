import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deliveryHealthApi, type DeliveryHealthPayload } from '../api/deliveryHealthApi';
import { useAuthStore } from '../store/authstore';
import { makeUser } from '../test/chatFixtures';
import { useDeliveryHealth } from './useDeliveryHealth';

vi.mock('../api/deliveryHealthApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/deliveryHealthApi')>();

  return {
    ...actual,
    deliveryHealthApi: {
      getDeliveryHealth: vi.fn(),
    },
  };
});

const mockedDeliveryHealthApi = vi.mocked(deliveryHealthApi);

const deliveryHealth: DeliveryHealthPayload = {
  generatedAt: '2026-06-30T12:00:00.000Z',
  window: {
    key: '24h',
    startedAt: '2026-06-29T12:00:00.000Z',
    endedAt: '2026-06-30T12:00:00.000Z',
  },
  summary: {
    status: 'ok',
    totalMessages: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    staleSent: 0,
    staleDelivered: 0,
    deliveryRate: 0,
    readRate: 0,
  },
  riskConversations: [],
  runtime: {
    status: 'ok',
    socket: {
      initialized: true,
      connectedUsers: 0,
      connectedSockets: 0,
      pendingCallTimeouts: 0,
      pendingCallDisconnectCleanups: 0,
    },
  },
  outbox: {
    status: 'ok',
    total: 0,
    attempts: 0,
    byStatus: {
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
    },
    byChannel: {
      email: {
        total: 0,
        attempts: 0,
        byStatus: {
          pending: 0,
          processing: 0,
          sent: 0,
          failed: 0,
        },
      },
      push: {
        total: 0,
        attempts: 0,
        byStatus: {
          pending: 0,
          processing: 0,
          sent: 0,
          failed: 0,
        },
      },
    },
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

describe('useDeliveryHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
    mockedDeliveryHealthApi.getDeliveryHealth.mockResolvedValue({
      data: {
        status: 'success',
        data: {
          deliveryHealth,
        },
      },
    } as unknown as Awaited<ReturnType<typeof deliveryHealthApi.getDeliveryHealth>>);
  });

  it('loads delivery health for admins', async () => {
    useAuthStore.setState({
      user: makeUser({ role: 'admin' }),
      isAuthenticated: true,
      isLoading: false,
    });

    const { result } = renderHook(() => useDeliveryHealth('24h'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toEqual(deliveryHealth));
    expect(mockedDeliveryHealthApi.getDeliveryHealth).toHaveBeenCalledWith('24h');
  });

  it('does not call the diagnostics API for non-admin users', () => {
    useAuthStore.setState({
      user: makeUser({ role: 'user' }),
      isAuthenticated: true,
      isLoading: false,
    });

    const { result } = renderHook(() => useDeliveryHealth('7d'), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedDeliveryHealthApi.getDeliveryHealth).not.toHaveBeenCalled();
  });
});
