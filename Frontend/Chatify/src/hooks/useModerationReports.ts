import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { moderationApi } from '../api/moderationApi';
import type {
  AbuseReport,
  AbuseReportStatus,
  ReviewAbuseReportPayload,
  SubmitAbuseReportPayload,
} from '../api/moderationApi';
import { useAuthStore } from '../store/authstore';

export type ModerationStatusFilter = AbuseReportStatus | 'all';

export const moderationReportsQueryKey = (status: ModerationStatusFilter) => ['moderationReports', status] as const;
export const moderationReportQueryKey = (reportId: string) => ['moderationReport', reportId] as const;

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

export const useSubmitAbuseReport = () => (
  useMutation<AbuseReport, unknown, SubmitAbuseReportPayload>({
    mutationFn: async (payload) => {
      const response = await moderationApi.submitReport(payload);
      return response.data.data.report;
    },
  })
);
