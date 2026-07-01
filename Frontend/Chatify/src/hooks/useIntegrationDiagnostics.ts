import { useQuery } from '@tanstack/react-query';
import { integrationDiagnosticsApi } from '../api/integrationDiagnosticsApi';
import { useAuthStore } from '../store/authstore';

export const integrationDiagnosticsQueryKey = ['integrationDiagnostics'] as const;

export const useIntegrationDiagnostics = () => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  return useQuery({
    queryKey: integrationDiagnosticsQueryKey,
    queryFn: async () => {
      const response = await integrationDiagnosticsApi.getIntegrationDiagnostics();
      return response.data.data.integrations;
    },
    enabled: isAdmin,
    retry: false,
  });
};
