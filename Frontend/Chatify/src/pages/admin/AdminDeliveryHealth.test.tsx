import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminDeliveryHealth from './AdminDeliveryHealth';
import { deliveryHealthApi, type DeliveryHealthPayload } from '../../api/deliveryHealthApi';
import { LOCALE_STORAGE_KEY, LocaleProvider } from '../../i18n';
import { useAuthStore } from '../../store/authstore';
import { makeUser } from '../../test/chatFixtures';

vi.mock('../../api/deliveryHealthApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/deliveryHealthApi')>();

  return {
    ...actual,
    deliveryHealthApi: {
      getDeliveryHealth: vi.fn(),
    },
  };
});

const mockedDeliveryHealthApi = vi.mocked(deliveryHealthApi);

const makeDeliveryHealth = (overrides: Partial<DeliveryHealthPayload> = {}): DeliveryHealthPayload => ({
  generatedAt: '2026-06-30T12:00:00.000Z',
  window: {
    key: '24h',
    startedAt: '2026-06-29T12:00:00.000Z',
    endedAt: '2026-06-30T12:00:00.000Z',
  },
  summary: {
    status: 'degraded',
    totalMessages: 12,
    sent: 3,
    delivered: 5,
    read: 4,
    staleSent: 2,
    staleDelivered: 1,
    deliveryRate: 75,
    readRate: 33.3,
  },
  riskConversations: [{
    chatId: 'chat-risk-1',
    kind: 'direct',
    memberCount: 2,
    recentMessages: 8,
    staleSent: 2,
    staleDelivered: 1,
    unreadEstimate: 4,
    riskScore: 12,
    latestActivityAt: '2026-06-30T11:45:00.000Z',
    flags: {
      hasStaleSent: true,
      hasStaleDelivered: true,
      hasUnreadEstimate: true,
    },
  }],
  runtime: {
    status: 'ok',
    socket: {
      initialized: true,
      connectedUsers: 4,
      connectedSockets: 5,
      pendingCallTimeouts: 0,
      pendingCallDisconnectCleanups: 1,
    },
  },
  outbox: {
    status: 'degraded',
    total: 3,
    attempts: 5,
    byStatus: {
      pending: 1,
      processing: 0,
      sent: 1,
      failed: 1,
    },
    byChannel: {
      email: {
        total: 2,
        attempts: 4,
        byStatus: {
          pending: 1,
          processing: 0,
          sent: 0,
          failed: 1,
        },
      },
      push: {
        total: 1,
        attempts: 1,
        byStatus: {
          pending: 0,
          processing: 0,
          sent: 1,
          failed: 0,
        },
      },
    },
  },
  ...overrides,
});

const renderDeliveryHealth = (role: 'user' | 'admin' = 'admin') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  useAuthStore.setState({
    user: makeUser({ role }),
    isAuthenticated: true,
    isLoading: false,
  });

  render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <MemoryRouter>
          <AdminDeliveryHealth />
        </MemoryRouter>
      </LocaleProvider>
    </QueryClientProvider>
  );

  return queryClient;
};

describe('AdminDeliveryHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
    mockedDeliveryHealthApi.getDeliveryHealth.mockResolvedValue({
      data: {
        status: 'success',
        data: {
          deliveryHealth: makeDeliveryHealth(),
        },
      },
    } as unknown as Awaited<ReturnType<typeof deliveryHealthApi.getDeliveryHealth>>);
  });

  it('shows a forbidden state for non-admin users', () => {
    renderDeliveryHealth('user');

    expect(screen.getByRole('heading', { name: 'Admin access required' })).toBeInTheDocument();
    expect(mockedDeliveryHealthApi.getDeliveryHealth).not.toHaveBeenCalled();
  });

  it('renders delivery metrics, risk metadata, and supports window refresh', async () => {
    const user = userEvent.setup();

    renderDeliveryHealth('admin');

    expect(await screen.findByRole('heading', { name: 'Delivery health' })).toBeInTheDocument();
    expect(await screen.findByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('33.3%')).toBeInTheDocument();
    expect(screen.getByText('Conversation #risk-1')).toBeInTheDocument();
    expect(screen.getByText('Connected users')).toBeInTheDocument();
    expect(screen.getByText('Notification outbox')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedDeliveryHealthApi.getDeliveryHealth).toHaveBeenCalledWith('24h');
    });

    await user.click(screen.getByRole('button', { name: '7 days' }));

    await waitFor(() => {
      expect(mockedDeliveryHealthApi.getDeliveryHealth).toHaveBeenCalledWith('7d');
    });

    await user.click(screen.getByRole('button', { name: 'Refresh diagnostics' }));

    await waitFor(() => {
      expect(mockedDeliveryHealthApi.getDeliveryHealth).toHaveBeenLastCalledWith('7d');
    });
  });

  it('renders loading, empty, and error states', async () => {
    mockedDeliveryHealthApi.getDeliveryHealth.mockReturnValueOnce(
      new Promise(() => undefined) as ReturnType<typeof deliveryHealthApi.getDeliveryHealth>
    );

    renderDeliveryHealth('admin');

    expect(screen.getByText('Loading delivery diagnostics')).toBeInTheDocument();

    mockedDeliveryHealthApi.getDeliveryHealth.mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          deliveryHealth: makeDeliveryHealth({ riskConversations: [] }),
        },
      },
    } as unknown as Awaited<ReturnType<typeof deliveryHealthApi.getDeliveryHealth>>);
    renderDeliveryHealth('admin');

    expect(await screen.findByText('No delivery risk in this window')).toBeInTheDocument();

    mockedDeliveryHealthApi.getDeliveryHealth.mockRejectedValueOnce(new Error('delivery unavailable'));
    renderDeliveryHealth('admin');

    expect(await screen.findByText('Delivery diagnostics unavailable. Refresh or check backend readiness.')).toBeInTheDocument();
  });

  it('renders localized Arabic labels in RTL mode', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ar');

    renderDeliveryHealth('admin');

    expect(await screen.findByRole('heading', { name: 'صحة التسليم' })).toBeInTheDocument();
    expect(await screen.findByText('تشخيصات المشرف')).toBeInTheDocument();
    expect(await screen.findByText('الرسائل')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('dir', 'rtl');
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });
});
