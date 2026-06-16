import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../api/userApi';
import { useAuthStore } from '../store/authstore';
import type { User } from '../types/auth';
import {
  chatsQueryKey,
  onlinePresenceQueryKey,
  userSearchQueryKey,
  usersQueryKey,
} from './useChatQueries';

export const authQueryKey = ['auth'] as const;

const updateCurrentUser = (
  queryClient: ReturnType<typeof useQueryClient>,
  setUser: (user: User | null) => void,
  user: User
) => {
  setUser(user);
  queryClient.setQueryData<User | null>(authQueryKey, user);
};

const invalidateProfileImageDependents = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: authQueryKey });
  queryClient.invalidateQueries({ queryKey: chatsQueryKey });
  queryClient.invalidateQueries({ queryKey: onlinePresenceQueryKey });
  queryClient.invalidateQueries({ queryKey: usersQueryKey });
  queryClient.invalidateQueries({ queryKey: userSearchQueryKey });
};

export const useProfileImageMutation = () => {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  const uploadProfileImage = useMutation({
    mutationFn: async (file: File) => {
      const response = await userApi.uploadProfileImage(file);
      return response.data.data.user;
    },
    onSuccess: (user) => {
      updateCurrentUser(queryClient, setUser, user);
      invalidateProfileImageDependents(queryClient);
    },
  });

  const removeProfileImage = useMutation({
    mutationFn: async () => {
      const response = await userApi.removeProfileImage();
      return response.data.data.user;
    },
    onSuccess: (user) => {
      updateCurrentUser(queryClient, setUser, user);
      invalidateProfileImageDependents(queryClient);
    },
  });

  return {
    uploadProfileImage,
    removeProfileImage,
    isPending: uploadProfileImage.isPending || removeProfileImage.isPending,
  };
};
