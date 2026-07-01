import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminHub from './AdminHub';
import { deliveryHealthApi, type DeliveryHealthPayload } from '../../api/deliveryHealthApi';
import { integrationDiagnosticsApi, type IntegrationDiagnosticsPayload } from '../../api/integrationDiagnosticsApi';
import { moderationApi, type ModerationOpsSummary } from '../../api/moderationApi';
import { privacyOperationsApi, type PrivacyOperationsPayload } from '../../api/privacyOperationsApi';
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

vi.mock('../../api/moderationApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/moderationApi')>();

  return {
    ...actual,
    moderationApi: {
      ...actual.moderationApi,
      getOpsSummary: vi.fn(),
    },
  };
});

vi.mock('../../api/privacyOperationsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/privacyOperationsApi')>();

  return {
    ...actual,
    privacyOperationsApi: {
      getPrivacyOperations: vi.fn(),
    },
  };
});

vi.mock('../../api/integrationDiagnosticsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/integrationDiagnosticsApi')>();

  return {
    ...actual,
    integrationDiagnosticsApi: {
      getIntegrationDiagnostics: vi.fn(),
    },
  };
});

const mockedDeliveryHealthApi = vi.mocked(deliveryHealthApi);
const mockedIntegrationDiagnosticsApi = vi.mocked(integrationDiagnosticsApi);
const mockedModerationApi = vi.mocked(moderationApi);
const mockedPrivacyOperationsApi = vi.mocked(privacyOperationsApi);

const makeModerationSummary = (overrides: Partial<ModerationOpsSummary> = {}): ModerationOpsSummary => ({
  reportsByStatus: { open: 3, reviewed: 1, dismissed: 0, action_taken: 2 },
  appealsByStatus: { open: 1, under_review: 1, accepted: 0, rejected: 0 },
  unassignedOpen: 2,
  assignedToMeOpen: 1,
  oldestOpenAgeMinutes: 42,
  ...overrides,
});

const makeDeliveryHealth = (overrides: Partial<DeliveryHealthPayload> = {}): DeliveryHealthPayload => ({
  generatedAt: '2026-07-01T03:00:00.000Z',
  window: {
    key: '24h',
    startedAt: '2026-06-30T03:00:00.000Z',
    endedAt: '2026-07-01T03:00:00.000Z',
  },
  summary: {
    status: 'degraded',
    totalMessages: 22,
    sent: 5,
    delivered: 11,
    read: 6,
    staleSent: 2,
    staleDelivered: 1,
    deliveryRate: 72.5,
    readRate: 40,
  },
  riskConversations: [],
  runtime: {
    status: 'ok',
    socket: {
      initialized: true,
      connectedUsers: 3,
      connectedSockets: 4,
      pendingCallTimeouts: 0,
      pendingCallDisconnectCleanups: 0,
    },
  },
  outbox: {
    status: 'degraded',
    total: 2,
    attempts: 3,
    byStatus: { pending: 1, processing: 0, sent: 0, failed: 1 },
    byChannel: {
      email: {
        total: 1,
        attempts: 2,
        byStatus: { pending: 0, processing: 0, sent: 0, failed: 1 },
      },
      push: {
        total: 1,
        attempts: 1,
        byStatus: { pending: 1, processing: 0, sent: 0, failed: 0 },
      },
    },
  },
  ...overrides,
});

const makePrivacyOperations = (overrides: Partial<PrivacyOperationsPayload> = {}): PrivacyOperationsPayload => ({
  generatedAt: '2026-07-01T04:00:00.000Z',
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
      startedAt: '2026-07-01T03:58:00.000Z',
      completedAt: '2026-07-01T04:00:00.000Z',
      counts: {
        deletionRequestsProcessed: 1,
      },
    },
  },
  ...overrides,
});

const makeIntegrationDiagnostics = (overrides: Partial<IntegrationDiagnosticsPayload> = {}): IntegrationDiagnosticsPayload => ({
  generatedAt: '2026-07-01T10:00:00.000Z',
  status: 'ok',
  apps: {
    total: 2,
    active: 2,
  },
  installations: {
    active: 3,
    revoked: 1,
  },
  runtime: {
    manifestReads: 5,
    deniedAccess: 0,
  },
  scopes: {
    'messages:read': 2,
    'webhooks:send': 1,
  },
  latestAuditAt: '2026-07-01T09:58:00.000Z',
  ...overrides,
});

const renderHub = (role: 'user' | 'admin' = 'admin') => {
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
          <AdminHub />
        </MemoryRouter>
      </LocaleProvider>
    </QueryClientProvider>
  );

  return queryClient;
};

describe('AdminHub', () => {
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
    mockedModerationApi.getOpsSummary.mockResolvedValue({
      data: {
        status: 'success',
        data: { summary: makeModerationSummary() },
      },
    } as unknown as Awaited<ReturnType<typeof moderationApi.getOpsSummary>>);
    mockedDeliveryHealthApi.getDeliveryHealth.mockResolvedValue({
      data: {
        status: 'success',
        data: { deliveryHealth: makeDeliveryHealth() },
      },
    } as unknown as Awaited<ReturnType<typeof deliveryHealthApi.getDeliveryHealth>>);
    mockedPrivacyOperationsApi.getPrivacyOperations.mockResolvedValue({
      data: {
        status: 'success',
        data: { privacyOperations: makePrivacyOperations() },
      },
    } as unknown as Awaited<ReturnType<typeof privacyOperationsApi.getPrivacyOperations>>);
    mockedIntegrationDiagnosticsApi.getIntegrationDiagnostics.mockResolvedValue({
      data: {
        status: 'success',
        data: { integrations: makeIntegrationDiagnostics() },
      },
    } as unknown as Awaited<ReturnType<typeof integrationDiagnosticsApi.getIntegrationDiagnostics>>);
  });

  it('shows a restricted state for non-admin users without loading admin summaries', () => {
    renderHub('user');

    expect(screen.getByRole('heading', { name: 'Admin access required' })).toBeInTheDocument();
    expect(mockedModerationApi.getOpsSummary).not.toHaveBeenCalled();
    expect(mockedDeliveryHealthApi.getDeliveryHealth).not.toHaveBeenCalled();
    expect(mockedPrivacyOperationsApi.getPrivacyOperations).not.toHaveBeenCalled();
    expect(mockedIntegrationDiagnosticsApi.getIntegrationDiagnostics).not.toHaveBeenCalled();
  });

  it('renders operations cards with aggregate-only links and metrics', async () => {
    renderHub('admin');

    expect(screen.getByRole('heading', { name: 'Operations hub' })).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedModerationApi.getOpsSummary).toHaveBeenCalledTimes(1);
      expect(mockedDeliveryHealthApi.getDeliveryHealth).toHaveBeenCalledWith('24h');
      expect(mockedPrivacyOperationsApi.getPrivacyOperations).toHaveBeenCalledTimes(1);
      expect(mockedIntegrationDiagnosticsApi.getIntegrationDiagnostics).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('link', { name: 'Open moderation queue' })).toHaveAttribute('href', '/admin/moderation');
    expect(screen.getByRole('link', { name: 'Open delivery health' })).toHaveAttribute('href', '/admin/delivery-health');
    expect(screen.getByRole('link', { name: 'Open privacy operations' })).toHaveAttribute('href', '/admin/privacy-operations');
    expect(screen.getByRole('link', { name: 'Open integrations' })).toHaveAttribute('href', '/admin/integrations');
    expect(await screen.findByText('3 open')).toBeInTheDocument();
    expect(await screen.findByText('22')).toBeInTheDocument();
    expect(await screen.findByText('72.5%')).toBeInTheDocument();
    expect(screen.getByText('Bot integrations')).toBeInTheDocument();
    expect((await screen.findAllByText('Attention')).length).toBeGreaterThan(0);
  });

  it('keeps tool links available when summaries are unavailable', async () => {
    mockedModerationApi.getOpsSummary.mockRejectedValueOnce(new Error('summary unavailable'));
    mockedDeliveryHealthApi.getDeliveryHealth.mockRejectedValueOnce(new Error('delivery unavailable'));
    mockedPrivacyOperationsApi.getPrivacyOperations.mockRejectedValueOnce(new Error('privacy unavailable'));
    mockedIntegrationDiagnosticsApi.getIntegrationDiagnostics.mockRejectedValueOnce(new Error('integration unavailable'));

    renderHub('admin');

    expect((await screen.findAllByText('Unavailable')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('link', { name: 'Open moderation queue' })).toHaveAttribute('href', '/admin/moderation');
    expect(screen.getByRole('link', { name: 'Open delivery health' })).toHaveAttribute('href', '/admin/delivery-health');
    expect(screen.getByRole('link', { name: 'Open privacy operations' })).toHaveAttribute('href', '/admin/privacy-operations');
    expect(screen.getByRole('link', { name: 'Open integrations' })).toHaveAttribute('href', '/admin/integrations');
  });

  it('renders localized Arabic labels in RTL mode', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ar');

    renderHub('admin');

    expect(await screen.findByRole('heading', { name: 'مركز العمليات' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('dir', 'rtl');
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');

    const tools = screen.getByRole('region', { name: 'أدوات المشرف' });
    expect(within(tools).getByRole('link', { name: 'فتح قائمة الإشراف' })).toHaveAttribute('href', '/admin/moderation');
    expect(within(tools).getByRole('link', { name: 'فتح عمليات الخصوصية' })).toHaveAttribute('href', '/admin/privacy-operations');
    expect(within(tools).getByRole('link', { name: 'فتح التكاملات' })).toHaveAttribute('href', '/admin/integrations');
  });
});
