import { useQuery } from '@tanstack/react-query';
import { privacyOperationsApi } from '../api/privacyOperationsApi';
import { useAuthStore } from '../store/authstore';

export const privacyOperationsQueryKey = ['privacyOperations'] as const;

export const usePrivacyOperations = () => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  return useQuery({
    queryKey: privacyOperationsQueryKey,
    queryFn: async () => {
      const response = await privacyOperationsApi.getPrivacyOperations();
      return response.data.data.privacyOperations;
    },
    enabled: isAdmin,
    retry: false,
  });
};
