import axiosInstance from './axios';
import type { AxiosResponse } from 'axios';

export type AbuseReportTargetType = 'user' | 'message' | 'conversation';
export type AbuseReportStatus = 'open' | 'reviewed' | 'dismissed' | 'action_taken';
export type AbuseReportReason =
  | 'spam'
  | 'harassment'
  | 'impersonation'
  | 'privacy'
  | 'illegal'
  | 'other';
export type ModerationAction =
  | 'none'
  | 'warned'
  | 'restricted'
  | 'restriction_lifted'
  | 'content_removed'
  | 'account_review';
export type AbuseReportPriority = 'normal' | 'medium' | 'high';

export interface ModerationIdentity {
  userId: string | null;
  username?: string;
  displayName: string;
}

export interface AbuseReportContext {
  reportedUser?: ModerationIdentity;
  chat?: {
    chatId: string | null;
    isGroupChat?: boolean;
    memberCount?: number;
  };
  message?: {
    messageId: string | null;
    sender: string | null;
    messageType?: string;
    textPreview?: string;
    attachmentCount?: number;
    createdAt?: string;
  };
}

export interface ModerationEnforcement {
  action: ModerationAction;
  targetType: 'none' | 'user' | 'message' | 'conversation';
  targetId?: string | null;
  appliedBy?: string | null;
  appliedAt?: string;
  expiresAt?: string | null;
  summary?: string;
}

export interface AbuseReportAuditEntry {
  actor: string | null;
  status: AbuseReportStatus;
  moderationAction: ModerationAction;
  note?: string;
  enforcement?: ModerationEnforcement;
  createdAt?: string;
}

export interface AbuseReport {
  _id: string;
  reporter: string | null;
  reporterIdentity?: ModerationIdentity | null;
  targetType: AbuseReportTargetType;
  reportedUser?: string | null;
  reportedUserIdentity?: ModerationIdentity | null;
  chat?: string | null;
  message?: string | null;
  reason: AbuseReportReason;
  details?: string;
  status: AbuseReportStatus;
  priority: AbuseReportPriority;
  moderationAction: ModerationAction;
  moderationNote?: string;
  enforcement?: ModerationEnforcement;
  reviewedBy?: string | null;
  reviewedAt?: string;
  context?: AbuseReportContext;
  auditTrail: AbuseReportAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

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
    report: AbuseReport;
  };
}

export interface AbuseReportsResponse {
  status: string;
  data: {
    reports: AbuseReport[];
  };
}

export interface ReviewAbuseReportPayload {
  status: Exclude<AbuseReportStatus, 'open'>;
  moderationAction: ModerationAction;
  note?: string;
}

export const moderationApi = {
  submitReport: (payload: SubmitAbuseReportPayload): Promise<AxiosResponse<AbuseReportResponse>> =>
    axiosInstance.post('/api/moderation/reports', payload),
  listReports: (status?: AbuseReportStatus | 'all', limit = 50): Promise<AxiosResponse<AbuseReportsResponse>> =>
    axiosInstance.get('/api/moderation/reports', {
      params: {
        status: status && status !== 'all' ? status : undefined,
        limit,
      },
    }),
  getReport: (reportId: string): Promise<AxiosResponse<AbuseReportResponse>> =>
    axiosInstance.get(`/api/moderation/reports/${reportId}`),
  reviewReport: (
    reportId: string,
    payload: ReviewAbuseReportPayload
  ): Promise<AxiosResponse<AbuseReportResponse>> =>
    axiosInstance.patch(`/api/moderation/reports/${reportId}/review`, payload),
};
