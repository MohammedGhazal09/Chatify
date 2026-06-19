import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminModeration from './AdminModeration';
import { moderationApi, type AbuseReport } from '../../api/moderationApi';
import { useAuthStore } from '../../store/authstore';
import { makeUser } from '../../test/chatFixtures';

vi.mock('../../api/moderationApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/moderationApi')>();

  return {
    ...actual,
    moderationApi: {
      submitReport: vi.fn(),
      listReports: vi.fn(),
      getReport: vi.fn(),
      reviewReport: vi.fn(),
    },
  };
});

const mockedModerationApi = vi.mocked(moderationApi);

const makeReport = (overrides: Partial<AbuseReport> = {}): AbuseReport => ({
  _id: 'report-1',
  reporter: 'reporter-1',
  reporterIdentity: {
    userId: 'reporter-1',
    username: 'ada.reporter',
    displayName: 'Ada Reporter',
  },
  targetType: 'message',
  reportedUser: 'reported-1',
  reportedUserIdentity: {
    userId: 'reported-1',
    username: 'grace.reported',
    displayName: 'Grace Reported',
  },
  chat: 'chat-1',
  message: 'message-1',
  reason: 'harassment',
  details: 'Redacted details only.',
  status: 'open',
  priority: 'high',
  moderationAction: 'none',
  moderationNote: '',
  context: {
    chat: {
      chatId: 'chat-1',
      isGroupChat: false,
      memberCount: 2,
    },
    message: {
      messageId: 'message-1',
      sender: 'reported-1',
      messageType: 'text',
      textPreview: 'Redacted message preview',
      attachmentCount: 0,
      createdAt: '2026-06-20T08:00:00.000Z',
    },
  },
  auditTrail: [],
  createdAt: '2026-06-20T08:00:00.000Z',
  updatedAt: '2026-06-20T08:00:00.000Z',
  ...overrides,
});

const renderModeration = (role: 'user' | 'admin' = 'admin') => {
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
      <MemoryRouter>
        <AdminModeration />
      </MemoryRouter>
    </QueryClientProvider>
  );

  return queryClient;
};

describe('AdminModeration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('shows a forbidden state for non-admin users', () => {
    renderModeration('user');

    expect(screen.getByRole('heading', { name: 'Admin access required' })).toBeInTheDocument();
    expect(mockedModerationApi.listReports).not.toHaveBeenCalled();
  });

  it('renders a loading state while reports are pending', () => {
    mockedModerationApi.listReports.mockReturnValue(new Promise(() => undefined));

    renderModeration('admin');

    expect(screen.getByRole('status')).toHaveTextContent('Loading reports');
  });

  it('renders an empty report queue', async () => {
    mockedModerationApi.listReports.mockResolvedValue({
      data: { status: 'success', data: { reports: [] } },
    } as unknown as Awaited<ReturnType<typeof moderationApi.listReports>>);

    renderModeration('admin');

    expect(await screen.findByText('No reports match this filter')).toBeInTheDocument();
  });

  it('renders a recoverable report load error', async () => {
    mockedModerationApi.listReports.mockRejectedValue({
      response: { data: { message: 'Admin access required' } },
      isAxiosError: true,
    });

    renderModeration('admin');

    expect(await screen.findByRole('alert')).toHaveTextContent('Reports unavailable');
  });

  it('lists reports, shows redacted detail, and submits a review action', async () => {
    const user = userEvent.setup();
    const report = makeReport();
    const reviewedReport = makeReport({
      status: 'action_taken',
      moderationAction: 'restricted',
      moderationNote: 'Restrict after review',
      auditTrail: [{
        actor: 'admin-1',
        status: 'action_taken',
        moderationAction: 'restricted',
        note: 'Restrict after review',
        createdAt: '2026-06-20T08:30:00.000Z',
      }],
    });

    mockedModerationApi.listReports.mockResolvedValue({
      data: { status: 'success', data: { reports: [report] } },
    } as unknown as Awaited<ReturnType<typeof moderationApi.listReports>>);
    mockedModerationApi.getReport.mockResolvedValue({
      data: { status: 'success', data: { report } },
    } as unknown as Awaited<ReturnType<typeof moderationApi.getReport>>);
    mockedModerationApi.reviewReport.mockResolvedValue({
      data: { status: 'success', data: { report: reviewedReport } },
    } as unknown as Awaited<ReturnType<typeof moderationApi.reviewReport>>);

    renderModeration('admin');

    expect(await screen.findByRole('button', { name: /High priority message report from Ada Reporter/ })).toBeInTheDocument();
    expect(await screen.findByText('Redacted message preview')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Enforcement'), 'restricted');
    await user.clear(screen.getByLabelText('Reviewer note'));
    await user.type(screen.getByLabelText('Reviewer note'), 'Restrict after review');
    await user.click(screen.getByRole('button', { name: 'Save review' }));

    await waitFor(() => {
      expect(mockedModerationApi.reviewReport).toHaveBeenCalledWith('report-1', {
        status: 'action_taken',
        moderationAction: 'restricted',
        note: 'Restrict after review',
      });
    });
    expect(await screen.findByText('Review saved.')).toBeInTheDocument();
  });
});
