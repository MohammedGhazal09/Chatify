import { useMutation } from '@tanstack/react-query';
import { moderationApi } from '../api/moderationApi';
import type { SubmitAbuseReportPayload } from '../api/moderationApi';

export const useSubmitAbuseReport = () => {
  return useMutation({
    mutationFn: async (payload: SubmitAbuseReportPayload) => {
      const response = await moderationApi.submitReport(payload);
      return response.data.data.report;
    },
  });
};
