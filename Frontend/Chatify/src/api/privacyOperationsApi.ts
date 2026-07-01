import type { AxiosResponse } from 'axios';
import axiosInstance from './axios';

export type PrivacyOperationsStatus = 'ok' | 'attention' | 'blocked';
export type PrivacyOperationRunStatus = 'completed' | 'failed';
export type PrivacyOperationRunTrigger = 'worker' | 'manual';

export interface PrivacyOperationRunCounts {
  deletionRequestsProcessed?: number;
  accountsAnonymized?: number;
  profileImagesDeleted?: number;
  sessionsRemoved?: number;
  passwordResetsDeleted?: number;
  notificationOutboxDeleted?: number;
  socketsDisconnected?: number;
  expiredExportAuditsDeleted?: number;
  expiredPasswordResetsDeleted?: number;
  expiredSessionsDeleted?: number;
  terminalNotificationOutboxDeleted?: number;
  errors?: number;
}

export interface PrivacyOperationRun {
  _id: string;
  status: PrivacyOperationRunStatus;
  trigger: PrivacyOperationRunTrigger;
  dryRun: boolean;
  startedAt: string | null;
  completedAt: string | null;
  counts: PrivacyOperationRunCounts;
}

export interface PrivacyOperationsPayload {
  generatedAt: string | null;
  status: PrivacyOperationsStatus;
  deletionRequests: {
    pending: number;
    due: number;
    completed: number;
  };
  retention: {
    cleanupBacklog: number;
    notificationOutboxRetentionDays: number;
    expiredExportAudits: number;
    expiredPasswordResets: number;
    expiredSessions: number;
    terminalNotificationOutbox: number;
  };
  worker: {
    enabled: boolean;
    intervalMs: number;
    batchSize: number;
    lastRun: PrivacyOperationRun | null;
  };
}

export interface PrivacyOperationsResponse {
  status: string;
  data: {
    privacyOperations: PrivacyOperationsPayload;
  };
}

export const privacyOperationsApi = {
  getPrivacyOperations: (): Promise<AxiosResponse<PrivacyOperationsResponse>> =>
    axiosInstance.get('/api/admin/privacy-operations'),
};
