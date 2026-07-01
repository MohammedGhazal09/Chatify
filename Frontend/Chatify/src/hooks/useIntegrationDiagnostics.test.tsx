import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { integrationDiagnosticsApi, type IntegrationDiagnosticsPayload } from '../api/integrationDiagnosticsApi';
import { useAuthStore } from '../store/authstore';
import { makeUser } from '../test/chatFixtures';
import { useIntegrationDiagnostics } from './useIntegrationDiagnostics';

vi.mock('../api/integrationDiagnosticsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/integrationDiagnosticsApi')>();

  return {
    ...actual,
    integrationDiagnosticsApi: {
      getIntegrationDiagnostics: vi.fn(),
    },
  };
});

const mockedIntegrationDiagnosticsApi = vi.mocked(integrationDiagnosticsApi);

const diagnostics: IntegrationDiagnosticsPayload = {
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
    'channels:read': 2,
    'webhooks:send': 1,
  },
  latestAuditAt: '2026-07-01T09:58:00.000Z',
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

describe('useIntegrationDiagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
    mockedIntegrationDiagnosticsApi.getIntegrationDiagnostics.mockResolvedValue({
      data: {
        status: 'success',
        data: {
          integrations: diagnostics,
        },
      },
    } as unknown as Awaited<ReturnType<typeof integrationDiagnosticsApi.getIntegrationDiagnostics>>);
  });

  it('loads integration diagnostics for admins', async () => {
    useAuthStore.setState({
      user: makeUser({ role: 'admin' }),
      isAuthenticated: true,
      isLoading: false,
    });

    const { result } = renderHook(() => useIntegrationDiagnostics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toEqual(diagnostics));
    expect(mockedIntegrationDiagnosticsApi.getIntegrationDiagnostics).toHaveBeenCalledTimes(1);
  });

  it('does not call the diagnostics API for non-admin users', () => {
    useAuthStore.setState({
      user: makeUser({ role: 'user' }),
      isAuthenticated: true,
      isLoading: false,
    });

    const { result } = renderHook(() => useIntegrationDiagnostics(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedIntegrationDiagnosticsApi.getIntegrationDiagnostics).not.toHaveBeenCalled();
  });
});
