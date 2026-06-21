import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moderationApi } from '../api/moderationApi';
import { useAuthStore } from '../store/authstore';
import { makeUser } from '../test/chatFixtures';
import {
  moderationOpsSummaryQueryKey,
  myModerationEnforcementsQueryKey,
  useAssignModerationReport,
  useModerationOpsSummary,
  useMyModerationEnforcements,
  useReviewModerationAppeal,
  useSubmitModerationAppeal,
} from './useModerationReports';

vi.mock('../api/moderationApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/moderationApi')>();

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

const mockModerationApi = vi.mocked(moderationApi);

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useModerationReports operations', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
    useAuthStore.setState({
      user: makeUser({ role: 'admin' }),
      isAuthenticated: true,
      isLoading: false,
    });
    vi.clearAllMocks();
    mockModerationApi.getOpsSummary.mockResolvedValue({
      data: {
        status: 'success',
        data: {
          summary: {
            reportsByStatus: { open: 1, reviewed: 0, dismissed: 0, action_taken: 1 },
            appealsByStatus: { open: 1, under_review: 0, accepted: 0, rejected: 0 },
            unassignedOpen: 1,
            assignedToMeOpen: 0,
            oldestOpenAgeMinutes: 32,
          },
        },
      },
    } as Awaited<ReturnType<typeof moderationApi.getOpsSummary>>);
    mockModerationApi.listMyEnforcements.mockResolvedValue({
      data: {
        status: 'success',
        data: {
          enforcements: [{
            _id: 'report-1',
            targetType: 'message',
            reason: 'privacy',
            status: 'action_taken',
            moderationAction: 'restricted',
            createdAt: '2026-06-21T00:00:00.000Z',
            appeal: null,
            canAppeal: true,
          }],
        },
      },
    } as Awaited<ReturnType<typeof moderationApi.listMyEnforcements>>);
    mockModerationApi.assignReport.mockResolvedValue({
      data: {
        status: 'success',
        data: {
          report: {
            _id: 'report-1',
            reporter: null,
            targetType: 'message',
            reason: 'privacy',
            status: 'open',
            priority: 'high',
            moderationAction: 'none',
            appeals: [],
            auditTrail: [],
            createdAt: '2026-06-21T00:00:00.000Z',
            updatedAt: '2026-06-21T00:00:00.000Z',
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof moderationApi.assignReport>>);
    mockModerationApi.reviewAppeal.mockResolvedValue({
      data: {
        status: 'success',
        data: {
          appeal: {
            _id: 'appeal-1',
            user: 'user-2',
            status: 'accepted',
            reason: 'Please review',
          },
          report: {
            _id: 'report-1',
            reporter: null,
            reportedUser: 'user-2',
            targetType: 'message',
            reason: 'privacy',
            status: 'action_taken',
            priority: 'high',
            moderationAction: 'restricted',
            appeals: [],
            auditTrail: [],
            createdAt: '2026-06-21T00:00:00.000Z',
            updatedAt: '2026-06-21T00:00:00.000Z',
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof moderationApi.reviewAppeal>>);
    mockModerationApi.submitAppeal.mockResolvedValue({
      data: {
        status: 'success',
        data: {
          appeal: {
            _id: 'appeal-1',
            user: 'user-1',
            status: 'open',
            reason: 'Please review',
          },
        },
      },
    } as Awaited<ReturnType<typeof moderationApi.submitAppeal>>);
  });

  it('loads admin operations summary only for admins', async () => {
    const { result } = renderHook(() => useModerationOpsSummary(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.data?.appealsByStatus.open).toBe(1);
    });
    expect(moderationApi.getOpsSummary).toHaveBeenCalledTimes(1);

    useAuthStore.setState({ user: makeUser({ role: 'user' }) });
    renderHook(() => useModerationOpsSummary(), {
      wrapper: createWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
    });
    expect(moderationApi.getOpsSummary).toHaveBeenCalledTimes(1);
  });

  it('loads own enforcements and invalidates them after submitting an appeal', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const enforcements = renderHook(() => useMyModerationEnforcements(true), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(enforcements.result.current.data?.[0]?.canAppeal).toBe(true);
    });

    const appeal = renderHook(() => useSubmitModerationAppeal(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await appeal.result.current.mutateAsync({
        reportId: 'report-1',
        payload: { reason: 'Please review' },
      });
    });

    expect(moderationApi.submitAppeal).toHaveBeenCalledWith('report-1', { reason: 'Please review' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: myModerationEnforcementsQueryKey });
  });

  it('invalidates reviewer operations after assignment and appeal review', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const assign = renderHook(() => useAssignModerationReport(), {
      wrapper: createWrapper(queryClient),
    });
    const reviewAppeal = renderHook(() => useReviewModerationAppeal(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await assign.result.current.mutateAsync({ reportId: 'report-1' });
      await reviewAppeal.result.current.mutateAsync({
        reportId: 'report-1',
        appealId: 'appeal-1',
        payload: { status: 'accepted', reviewerNote: 'Accepted' },
      });
    });

    expect(moderationApi.assignReport).toHaveBeenCalledWith('report-1', {});
    expect(moderationApi.reviewAppeal).toHaveBeenCalledWith('report-1', 'appeal-1', {
      status: 'accepted',
      reviewerNote: 'Accepted',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: moderationOpsSummaryQueryKey });
  });
});
