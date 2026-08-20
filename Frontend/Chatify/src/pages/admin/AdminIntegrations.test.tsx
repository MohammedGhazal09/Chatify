import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { integrationDiagnosticsApi, type IntegrationDiagnosticsPayload } from '../../api/integrationDiagnosticsApi';
import { LOCALE_STORAGE_KEY, LocaleProvider } from '../../i18n';
import { useAuthStore } from '../../store/authstore';
import { makeUser } from '../../test/chatFixtures';
import AdminIntegrations from './AdminIntegrations';

vi.mock('../../api/integrationDiagnosticsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/integrationDiagnosticsApi')>();

  return {
    ...actual,
    integrationDiagnosticsApi: {
      getIntegrationDiagnostics: vi.fn(),
    },
  };
});

const mockedIntegrationDiagnosticsApi = vi.mocked(integrationDiagnosticsApi);

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

const renderIntegrations = (role: 'user' | 'admin' = 'admin') => {
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
          <AdminIntegrations />
        </MemoryRouter>
      </LocaleProvider>
    </QueryClientProvider>
  );

  return queryClient;
};

describe('AdminIntegrations', () => {
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
    mockedIntegrationDiagnosticsApi.getIntegrationDiagnostics.mockResolvedValue({
      data: {
        status: 'success',
        data: { integrations: makeIntegrationDiagnostics() },
      },
    } as unknown as Awaited<ReturnType<typeof integrationDiagnosticsApi.getIntegrationDiagnostics>>);
  });

  it('shows a restricted state for non-admin users without loading diagnostics', () => {
    renderIntegrations('user');

    expect(screen.getByRole('heading', { name: 'Admin access required' })).toBeInTheDocument();
    expect(mockedIntegrationDiagnosticsApi.getIntegrationDiagnostics).not.toHaveBeenCalled();
  });

  it('renders aggregate integration diagnostics without private tokens or identities', async () => {
    renderIntegrations('admin');

    expect(screen.getByRole('heading', { name: 'Bot integrations' })).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedIntegrationDiagnosticsApi.getIntegrationDiagnostics).toHaveBeenCalledTimes(1);
    });

    const permissionBoundary = await screen.findByRole('region', { name: 'Permission boundary' });
    expect(within(permissionBoundary).getByText('Active apps')).toBeInTheDocument();
    expect(screen.getByText('Runtime manifest')).toBeInTheDocument();
    expect(screen.getByText('Scope usage')).toBeInTheDocument();
    expect(screen.getByText('messages:read')).toBeInTheDocument();
    expect(screen.getAllByText('OK').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('integration-owner@example.test');
    expect(document.body.textContent).not.toContain('plain-runtime-token');
    expect(document.body.textContent).not.toContain('tokenHash');
  });

  it('keeps the diagnostics shell available when the API fails', async () => {
    mockedIntegrationDiagnosticsApi.getIntegrationDiagnostics.mockRejectedValueOnce(new Error('integration unavailable'));

    renderIntegrations('admin');

    expect(await screen.findByText('Integration diagnostics unavailable. Refresh or check backend readiness.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh diagnostics' })).toBeInTheDocument();
  });

  it('renders localized Arabic labels in RTL mode', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ar');

    renderIntegrations('admin');

    expect(await screen.findByRole('heading', { name: 'تكاملات البوت' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('dir', 'rtl');
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(await screen.findByRole('region', { name: 'حدود الأذونات' })).toBeInTheDocument();
  });
});
