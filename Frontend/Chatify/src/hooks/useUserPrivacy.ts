import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../api/userApi';

export const userPrivacySummaryQueryKey = ['userPrivacySummary'] as const;

export interface PrivacyRetentionSummary {
  scheduledFor?: string | null;
  reversibleUntil?: string | null;
  accountProfile?: string;
  authentication?: string;
  conversations?: string;
  media?: string;
  moderation?: string;
  backups?: string;
}

export interface PrivacyDeletionRequest {
  _id: string;
  type: 'account_deletion';
  status: 'pending' | 'completed' | 'canceled';
  requestedAt: string | null;
  completedAt?: string | null;
  scheduledFor?: string | null;
  canceledAt?: string | null;
  expiresAt?: string | null;
  recordCounts?: Record<string, number>;
  retentionSummary?: PrivacyRetentionSummary;
}

export interface PrivacySummary {
  exportVersion: string;
  deletionRequest: PrivacyDeletionRequest | null;
  retentionSummary: PrivacyRetentionSummary;
}

export interface PrivacyExportResponse {
  export: Record<string, unknown>;
  audit: {
    _id: string;
    type: 'account_export';
    status: 'completed';
    recordCounts?: Record<string, number>;
  };
}

export interface DeletionRequestResponse {
  deletionRequest: PrivacyDeletionRequest;
  retentionSummary: PrivacyRetentionSummary;
}

export const useUserPrivacySummary = (enabled: boolean) => useQuery({
  queryKey: userPrivacySummaryQueryKey,
  queryFn: async () => {
    const response = await userApi.getPrivacySummary();
    return response.data.data;
  },
  enabled,
});

export const useExportAccountData = () => useMutation<PrivacyExportResponse>({
  mutationFn: async () => {
    const response = await userApi.exportAccountData();
    return response.data.data;
  },
});

export const useRequestAccountDeletion = () => {
  const queryClient = useQueryClient();

  return useMutation<DeletionRequestResponse>({
    mutationFn: async () => {
      const response = await userApi.requestAccountDeletion();
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userPrivacySummaryQueryKey });
    },
  });
};

export const useCancelAccountDeletion = () => {
  const queryClient = useQueryClient();

  return useMutation<DeletionRequestResponse>({
    mutationFn: async () => {
      const response = await userApi.cancelAccountDeletion();
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userPrivacySummaryQueryKey });
    },
  });
};
