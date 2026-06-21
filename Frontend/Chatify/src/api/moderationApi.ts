import axiosInstance from './axios';
import type { AxiosResponse } from 'axios';

export type AbuseReportTargetType = 'user' | 'message' | 'conversation';
export type AbuseReportStatus = 'open' | 'reviewed' | 'dismissed' | 'action_taken';
export type ModerationAppealStatus = 'open' | 'under_review' | 'accepted' | 'rejected';
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

export interface ModerationAssignmentHistory {
  assignedTo: string | null;
  assignedToIdentity?: ModerationIdentity | null;
  assignedBy: string | null;
  assignedByIdentity?: ModerationIdentity | null;
  createdAt?: string;
}

export interface ModerationAppeal {
  _id: string;
  user: string | null;
  userIdentity?: ModerationIdentity | null;
  status: ModerationAppealStatus;
  reason: string;
  reviewerNote?: string;
  reviewedBy?: string | null;
  reviewedByIdentity?: ModerationIdentity | null;
  reviewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
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
  assignedTo?: string | null;
  assignedToIdentity?: ModerationIdentity | null;
  assignedBy?: string | null;
  assignedAt?: string;
  assignmentHistory?: ModerationAssignmentHistory[];
  appeals: ModerationAppeal[];
  context?: AbuseReportContext;
  auditTrail: AbuseReportAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface MyModerationEnforcement {
  _id: string;
  targetType: AbuseReportTargetType;
  reason: AbuseReportReason;
  status: AbuseReportStatus;
  moderationAction: ModerationAction;
  enforcement?: ModerationEnforcement;
  reviewedAt?: string;
  createdAt: string;
  appeal: ModerationAppeal | null;
  canAppeal: boolean;
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

export interface MyModerationEnforcementsResponse {
  status: string;
  data: {
    enforcements: MyModerationEnforcement[];
  };
}

export interface ModerationAppealResponse {
  status: string;
  data: {
    enforcement?: MyModerationEnforcement;
    appeal: ModerationAppeal;
    report?: AbuseReport;
  };
}

export interface ModerationOpsSummary {
  reportsByStatus: Record<AbuseReportStatus, number>;
  appealsByStatus: Record<ModerationAppealStatus, number>;
  unassignedOpen: number;
  assignedToMeOpen: number;
  oldestOpenAgeMinutes: number;
}

export interface ModerationOpsSummaryResponse {
  status: string;
  data: {
    summary: ModerationOpsSummary;
  };
}

export interface EnforcementHistoryResponse {
  status: string;
  data: {
    history: Array<{
      _id: string;
      targetType: AbuseReportTargetType;
      reason: AbuseReportReason;
      status: AbuseReportStatus;
      moderationAction: ModerationAction;
      moderationNote?: string;
      enforcement?: ModerationEnforcement;
      reviewedBy?: string | null;
      reviewedAt?: string;
      appeals: ModerationAppeal[];
      createdAt: string;
    }>;
  };
}

export interface ReviewAbuseReportPayload {
  status: Exclude<AbuseReportStatus, 'open'>;
  moderationAction: ModerationAction;
  note?: string;
}

export interface SubmitModerationAppealPayload {
  reason: string;
}

export interface ReviewModerationAppealPayload {
  status: Exclude<ModerationAppealStatus, 'open'>;
  reviewerNote?: string;
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
  listMyEnforcements: (): Promise<AxiosResponse<MyModerationEnforcementsResponse>> =>
    axiosInstance.get('/api/moderation/my-enforcements'),
  submitAppeal: (
    reportId: string,
    payload: SubmitModerationAppealPayload
  ): Promise<AxiosResponse<ModerationAppealResponse>> =>
    axiosInstance.post(`/api/moderation/reports/${reportId}/appeal`, payload),
  assignReport: (
    reportId: string,
    payload: { assignedTo?: string } = {}
  ): Promise<AxiosResponse<AbuseReportResponse>> =>
    axiosInstance.patch(`/api/moderation/reports/${reportId}/assign`, payload),
  getOpsSummary: (): Promise<AxiosResponse<ModerationOpsSummaryResponse>> =>
    axiosInstance.get('/api/moderation/ops-summary'),
  getEnforcementHistory: (userId: string): Promise<AxiosResponse<EnforcementHistoryResponse>> =>
    axiosInstance.get(`/api/moderation/users/${userId}/enforcement-history`),
  reviewAppeal: (
    reportId: string,
    appealId: string,
    payload: ReviewModerationAppealPayload
  ): Promise<AxiosResponse<ModerationAppealResponse>> =>
    axiosInstance.patch(`/api/moderation/reports/${reportId}/appeals/${appealId}`, payload),
  reviewReport: (
    reportId: string,
    payload: ReviewAbuseReportPayload
  ): Promise<AxiosResponse<AbuseReportResponse>> =>
    axiosInstance.patch(`/api/moderation/reports/${reportId}/review`, payload),
};
