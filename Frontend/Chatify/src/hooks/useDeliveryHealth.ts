import { useQuery } from '@tanstack/react-query';
import { deliveryHealthApi, type DeliveryHealthWindowKey } from '../api/deliveryHealthApi';
import { useAuthStore } from '../store/authstore';

export const deliveryHealthQueryKey = (windowKey: DeliveryHealthWindowKey) => ['deliveryHealth', windowKey] as const;

export const useDeliveryHealth = (windowKey: DeliveryHealthWindowKey) => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  return useQuery({
    queryKey: deliveryHealthQueryKey(windowKey),
    queryFn: async () => {
      const response = await deliveryHealthApi.getDeliveryHealth(windowKey);
      return response.data.data.deliveryHealth;
    },
    enabled: isAdmin,
    retry: false,
  });
};
