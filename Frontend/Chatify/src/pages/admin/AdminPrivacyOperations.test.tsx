import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { privacyOperationsApi, type PrivacyOperationsPayload } from '../../api/privacyOperationsApi';
import { LOCALE_STORAGE_KEY, LocaleProvider } from '../../i18n';
import { useAuthStore } from '../../store/authstore';
import { makeUser } from '../../test/chatFixtures';
import AdminPrivacyOperations from './AdminPrivacyOperations';

vi.mock('../../api/privacyOperationsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/privacyOperationsApi')>();

  return {
    ...actual,
    privacyOperationsApi: {
      getPrivacyOperations: vi.fn(),
    },
  };
});

const mockedPrivacyOperationsApi = vi.mocked(privacyOperationsApi);

const makePrivacyOperations = (overrides: Partial<PrivacyOperationsPayload> = {}): PrivacyOperationsPayload => ({
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
    lastRun: {
      _id: 'run-1',
      status: 'completed',
      trigger: 'worker',
      dryRun: false,
      startedAt: '2026-07-01T08:58:00.000Z',
      completedAt: '2026-07-01T09:00:00.000Z',
      counts: {
        deletionRequestsProcessed: 1,
        accountsAnonymized: 1,
      },
    },
  },
  ...overrides,
});

const renderPrivacyOperations = (role: 'user' | 'admin' = 'admin') => {
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
          <AdminPrivacyOperations />
        </MemoryRouter>
      </LocaleProvider>
    </QueryClientProvider>
  );

  return queryClient;
};

describe('AdminPrivacyOperations', () => {
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
    mockedPrivacyOperationsApi.getPrivacyOperations.mockResolvedValue({
      data: {
        status: 'success',
        data: { privacyOperations: makePrivacyOperations() },
      },
    } as unknown as Awaited<ReturnType<typeof privacyOperationsApi.getPrivacyOperations>>);
  });

  it('shows a restricted state for non-admin users without loading diagnostics', () => {
    renderPrivacyOperations('user');

    expect(screen.getByRole('heading', { name: 'Admin access required' })).toBeInTheDocument();
    expect(mockedPrivacyOperationsApi.getPrivacyOperations).not.toHaveBeenCalled();
  });

  it('renders aggregate worker and retention diagnostics without private data', async () => {
    renderPrivacyOperations('admin');

    expect(screen.getByRole('heading', { name: 'Privacy operations' })).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedPrivacyOperationsApi.getPrivacyOperations).toHaveBeenCalledTimes(1);
    });

    const queue = await screen.findByRole('region', { name: 'Deletion queue' });
    expect(within(queue).getByText('Pending deletions')).toBeInTheDocument();
    expect(within(queue).getByText('Due deletions')).toBeInTheDocument();
    expect(screen.getByText('Worker enabled')).toBeInTheDocument();
    expect(screen.getByText('Retention cleanup')).toBeInTheDocument();
    expect(screen.getByText('Expired export audits')).toBeInTheDocument();
    expect(screen.getAllByText('Attention').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('@example.test');
    expect(document.body.textContent).not.toContain('expired-reset-token');
  });

  it('keeps the diagnostics shell available when the API fails', async () => {
    mockedPrivacyOperationsApi.getPrivacyOperations.mockRejectedValueOnce(new Error('privacy unavailable'));

    renderPrivacyOperations('admin');

    expect(await screen.findByText('Privacy diagnostics unavailable. Refresh or check backend readiness.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh diagnostics' })).toBeInTheDocument();
  });

  it('renders localized Arabic labels in RTL mode', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ar');

    renderPrivacyOperations('admin');

    expect(await screen.findByRole('heading', { name: 'عمليات الخصوصية' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('dir', 'rtl');
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(await screen.findByRole('region', { name: 'قائمة الحذف' })).toBeInTheDocument();
  });
});
