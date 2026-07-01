import type { AxiosResponse } from 'axios';
import axiosInstance from './axios';

export type IntegrationDiagnosticsStatus = 'ok' | 'attention' | 'blocked';

export interface IntegrationDiagnosticsPayload {
  generatedAt: string | null;
  status: IntegrationDiagnosticsStatus;
  apps: {
    total: number;
    active: number;
  };
  installations: {
    active: number;
    revoked: number;
  };
  runtime: {
    manifestReads: number;
    deniedAccess: number;
  };
  scopes: Record<string, number>;
  latestAuditAt: string | null;
}

export interface IntegrationDiagnosticsResponse {
  status: string;
  data: {
    integrations: IntegrationDiagnosticsPayload;
  };
}

export const integrationDiagnosticsApi = {
  getIntegrationDiagnostics: (): Promise<AxiosResponse<IntegrationDiagnosticsResponse>> =>
    axiosInstance.get('/api/admin/integrations'),
};
