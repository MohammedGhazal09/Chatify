import axiosInstance from './axios';
import type { AxiosResponse } from 'axios';

export type AbuseReportTargetType = 'user' | 'message' | 'conversation';
export type AbuseReportReason =
  | 'spam'
  | 'harassment'
  | 'impersonation'
  | 'privacy'
  | 'illegal'
  | 'other';

export interface SubmitAbuseReportPayload {
  targetType: AbuseReportTargetType;
  reason: AbuseReportReason;
  chatId?: string;
  messageId?: string;
  reportedUserId?: string;
  details?: string;
}

export interface AbuseReportResponse {
  status: string;
  data: {
    report: {
      _id: string;
      targetType: AbuseReportTargetType;
      reason: AbuseReportReason;
      status: 'open' | 'reviewed' | 'dismissed' | 'action_taken';
      reportedUser?: string | null;
      chat?: string | null;
      message?: string | null;
    };
  };
}

export const moderationApi = {
  submitReport: (payload: SubmitAbuseReportPayload): Promise<AxiosResponse<AbuseReportResponse>> =>
    axiosInstance.post('/api/moderation/reports', payload),
};
