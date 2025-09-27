import useAuthStore from '../store/authStor';

export const useAuth = () => {
  return useAuthStore();
};