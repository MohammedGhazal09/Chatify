import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminModeration from './AdminModeration';
import { moderationApi, type AbuseReport } from '../../api/moderationApi';
import { LOCALE_STORAGE_KEY, LocaleProvider } from '../../i18n';
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
      listMyEnforcements: vi.fn(),
      submitAppeal: vi.fn(),
      assignReport: vi.fn(),
      getOpsSummary: vi.fn(),
      getEnforcementHistory: vi.fn(),
      reviewAppeal: vi.fn(),
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
  assignedTo: null,
  assignedToIdentity: null,
  assignmentHistory: [],
  appeals: [],
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
      <LocaleProvider>
        <MemoryRouter>
          <AdminModeration />
        </MemoryRouter>
      </LocaleProvider>
    </QueryClientProvider>
  );

  return queryClient;
};

describe('AdminModeration', () => {
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
        data: {
          summary: {
            reportsByStatus: { open: 1, reviewed: 0, dismissed: 0, action_taken: 1 },
            appealsByStatus: { open: 1, under_review: 0, accepted: 0, rejected: 0 },
            unassignedOpen: 1,
            assignedToMeOpen: 0,
            oldestOpenAgeMinutes: 34,
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof moderationApi.getOpsSummary>>);
    mockedModerationApi.getEnforcementHistory.mockResolvedValue({
      data: {
        status: 'success',
        data: {
          history: [],
        },
      },
    } as unknown as Awaited<ReturnType<typeof moderationApi.getEnforcementHistory>>);
  });

  it('shows a forbidden state for non-admin users', () => {
    renderModeration('user');

    expect(screen.getByRole('heading', { name: 'Admin access required' })).toBeInTheDocument();
    expect(mockedModerationApi.listReports).not.toHaveBeenCalled();
  });

  it('renders reviewer operations labels in Arabic RTL mode', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ar');

    renderModeration();

    expect(await screen.findByRole('heading', { name: 'الإشراف' })).toBeInTheDocument();
    expect(await screen.findByText('البلاغات المفتوحة')).toBeInTheDocument();
    expect(await screen.findByText('الاعتراضات المفتوحة')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('dir', 'rtl');
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  it('renders a loading state while reports are pending', () => {
    mockedModerationApi.listReports.mockReturnValue(new Promise(() => undefined));

    renderModeration('admin');

    expect(screen.getByText('Loading reports')).toBeInTheDocument();
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

    expect(await screen.findByText('Reports unavailable')).toBeInTheDocument();
  });

  it('lists reports, shows redacted detail, and submits a review action', async () => {
    const user = userEvent.setup();
    const report = makeReport({
      assignedTo: null,
      appeals: [{
        _id: 'appeal-1',
        user: 'reported-1',
        status: 'open',
        reason: 'Please review this restriction.',
        createdAt: '2026-06-20T08:20:00.000Z',
      }],
    });
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
    const assignedReport = makeReport({
      ...report,
      assignedTo: 'admin-1',
      assignedToIdentity: {
        userId: 'admin-1',
        username: 'admin.user',
        displayName: 'Admin User',
      },
      assignmentHistory: [{
        assignedTo: 'admin-1',
        assignedToIdentity: {
          userId: 'admin-1',
          username: 'admin.user',
          displayName: 'Admin User',
        },
        assignedBy: 'admin-1',
        createdAt: '2026-06-20T08:25:00.000Z',
      }],
    });
    const appealReviewedReport = makeReport({
      ...report,
      appeals: [{
        _id: 'appeal-1',
        user: 'reported-1',
        status: 'accepted',
        reason: 'Please review this restriction.',
        reviewerNote: 'Accepted after review',
        reviewedBy: 'admin-1',
        reviewedAt: '2026-06-20T08:40:00.000Z',
        createdAt: '2026-06-20T08:20:00.000Z',
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
    mockedModerationApi.assignReport.mockResolvedValue({
      data: { status: 'success', data: { report: assignedReport } },
    } as unknown as Awaited<ReturnType<typeof moderationApi.assignReport>>);
    mockedModerationApi.reviewAppeal.mockResolvedValue({
      data: {
        status: 'success',
        data: {
          report: appealReviewedReport,
          appeal: appealReviewedReport.appeals[0]!,
        },
      },
    } as unknown as Awaited<ReturnType<typeof moderationApi.reviewAppeal>>);
    mockedModerationApi.getEnforcementHistory.mockResolvedValue({
      data: {
        status: 'success',
        data: {
          history: [{
            _id: 'report-older',
            targetType: 'message',
            reason: 'privacy',
            status: 'action_taken',
            moderationAction: 'warned',
            reviewedAt: '2026-06-19T08:00:00.000Z',
            appeals: [],
            createdAt: '2026-06-19T07:00:00.000Z',
          }],
        },
      },
    } as unknown as Awaited<ReturnType<typeof moderationApi.getEnforcementHistory>>);

    renderModeration('admin');

    expect(await screen.findByText('Open appeals')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /High priority message report from Ada Reporter/ })).toBeInTheDocument();
    expect(await screen.findByText('Redacted message preview')).toBeInTheDocument();
    expect(await screen.findByText('Please review this restriction.')).toBeInTheDocument();
    expect(await screen.findAllByText('Warn user')).not.toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Assign to me' }));

    await waitFor(() => {
      expect(mockedModerationApi.assignReport).toHaveBeenCalledWith('report-1', {});
    });
    expect(await screen.findByText('Assigned to you.')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Appeal status'), 'accepted');
    await user.clear(screen.getByLabelText('Appeal reviewer note'));
    await user.type(screen.getByLabelText('Appeal reviewer note'), 'Accepted after review');
    await user.click(screen.getByRole('button', { name: 'Save appeal review' }));

    await waitFor(() => {
      expect(mockedModerationApi.reviewAppeal).toHaveBeenCalledWith('report-1', 'appeal-1', {
        status: 'accepted',
        reviewerNote: 'Accepted after review',
      });
    });
    expect(await screen.findByText('Appeal review saved.')).toBeInTheDocument();

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
