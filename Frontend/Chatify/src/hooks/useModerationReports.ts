import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { moderationApi } from '../api/moderationApi';
import type {
  AbuseReport,
  AbuseReportStatus,
  ReviewAbuseReportPayload,
  ReviewModerationAppealPayload,
  SubmitModerationAppealPayload,
  SubmitAbuseReportPayload,
} from '../api/moderationApi';
import { useAuthStore } from '../store/authstore';

export type ModerationStatusFilter = AbuseReportStatus | 'all';

export const moderationReportsQueryKey = (status: ModerationStatusFilter) => ['moderationReports', status] as const;
export const moderationReportQueryKey = (reportId: string) => ['moderationReport', reportId] as const;
export const moderationOpsSummaryQueryKey = ['moderationOpsSummary'] as const;
export const moderationEnforcementHistoryQueryKey = (userId: string) => ['moderationEnforcementHistory', userId] as const;
export const myModerationEnforcementsQueryKey = ['myModerationEnforcements'] as const;

export const useModerationReports = (status: ModerationStatusFilter) => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  return useQuery({
    queryKey: moderationReportsQueryKey(status),
    queryFn: async () => {
      const response = await moderationApi.listReports(status);
      return response.data.data.reports;
    },
    enabled: isAdmin,
    retry: false,
  });
};

export const useModerationReport = (reportId: string | null) => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  return useQuery({
    queryKey: moderationReportQueryKey(reportId ?? ''),
    queryFn: async () => {
      if (!reportId) {
        return null;
      }

      const response = await moderationApi.getReport(reportId);
      return response.data.data.report;
    },
    enabled: isAdmin && Boolean(reportId),
    retry: false,
  });
};

export const useReviewModerationReport = () => {
  const queryClient = useQueryClient();

  return useMutation<AbuseReport, unknown, { reportId: string; payload: ReviewAbuseReportPayload }>({
    mutationFn: async ({ reportId, payload }) => {
      const response = await moderationApi.reviewReport(reportId, payload);
      return response.data.data.report;
    },
    onSuccess: (report) => {
      queryClient.setQueryData(moderationReportQueryKey(report._id), report);
      queryClient.invalidateQueries({ queryKey: ['moderationReports'] });
    },
  });
};

export const useModerationOpsSummary = () => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  return useQuery({
    queryKey: moderationOpsSummaryQueryKey,
    queryFn: async () => {
      const response = await moderationApi.getOpsSummary();
      return response.data.data.summary;
    },
    enabled: isAdmin,
    retry: false,
  });
};

export const useUserEnforcementHistory = (userId?: string | null) => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  return useQuery({
    queryKey: moderationEnforcementHistoryQueryKey(userId ?? ''),
    queryFn: async () => {
      if (!userId) {
        return [];
      }

      const response = await moderationApi.getEnforcementHistory(userId);
      return response.data.data.history;
    },
    enabled: isAdmin && Boolean(userId),
    retry: false,
  });
};

export const useAssignModerationReport = () => {
  const queryClient = useQueryClient();

  return useMutation<AbuseReport, unknown, { reportId: string; assignedTo?: string }>({
    mutationFn: async ({ reportId, assignedTo }) => {
      const response = await moderationApi.assignReport(reportId, assignedTo ? { assignedTo } : {});
      return response.data.data.report;
    },
    onSuccess: (report) => {
      queryClient.setQueryData(moderationReportQueryKey(report._id), report);
      queryClient.invalidateQueries({ queryKey: ['moderationReports'] });
      queryClient.invalidateQueries({ queryKey: moderationOpsSummaryQueryKey });
    },
  });
};

export const useReviewModerationAppeal = () => {
  const queryClient = useQueryClient();

  return useMutation<AbuseReport, unknown, {
    reportId: string;
    appealId: string;
    payload: ReviewModerationAppealPayload;
  }>({
    mutationFn: async ({ reportId, appealId, payload }) => {
      const response = await moderationApi.reviewAppeal(reportId, appealId, payload);
      return response.data.data.report as AbuseReport;
    },
    onSuccess: (report) => {
      queryClient.setQueryData(moderationReportQueryKey(report._id), report);
      queryClient.invalidateQueries({ queryKey: ['moderationReports'] });
      queryClient.invalidateQueries({ queryKey: moderationOpsSummaryQueryKey });
      if (report.reportedUser) {
        queryClient.invalidateQueries({ queryKey: moderationEnforcementHistoryQueryKey(report.reportedUser) });
      }
    },
  });
};

export const useMyModerationEnforcements = (enabled: boolean) => useQuery({
  queryKey: myModerationEnforcementsQueryKey,
  queryFn: async () => {
    const response = await moderationApi.listMyEnforcements();
    return response.data.data.enforcements;
  },
  enabled,
  retry: false,
});

export const useSubmitModerationAppeal = () => {
  const queryClient = useQueryClient();

  return useMutation<unknown, unknown, { reportId: string; payload: SubmitModerationAppealPayload }>({
    mutationFn: async ({ reportId, payload }) => {
      const response = await moderationApi.submitAppeal(reportId, payload);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myModerationEnforcementsQueryKey });
    },
  });
};

export const useSubmitAbuseReport = () => (
  useMutation<AbuseReport, unknown, SubmitAbuseReportPayload>({
    mutationFn: async (payload) => {
      const response = await moderationApi.submitReport(payload);
      return response.data.data.report;
    },
  })
);
