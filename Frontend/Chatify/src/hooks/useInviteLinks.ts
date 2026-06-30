import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inviteApi } from '../api/inviteApi';
import type {
  CreateInviteLinkPayload,
  CreateInviteLinkResult,
  InviteLink,
  InviteTargetType,
  JoinInviteLinkResult,
} from '../types/invite';
import { chatsQueryKey } from './useChatQueries';
import { spacesQueryKey } from './useSpaceQueries';

export const inviteLinksQueryKey = (targetType: InviteTargetType, targetId: string) => (
  ['inviteLinks', targetType, targetId] as const
);

export const useInviteLinks = (
  targetType: InviteTargetType,
  targetId: string,
  enabled = true
) => useQuery({
  queryKey: inviteLinksQueryKey(targetType, targetId),
  queryFn: async () => {
    const response = await inviteApi.listInviteLinks(targetType, targetId);
    return response.data.data.invites;
  },
  enabled: Boolean(enabled && targetId),
});

export const useCreateInviteLink = () => {
  const queryClient = useQueryClient();

  return useMutation<
    CreateInviteLinkResult,
    unknown,
    { targetType: InviteTargetType; targetId: string; payload: CreateInviteLinkPayload }
  >({
    mutationFn: async ({ targetType, targetId, payload }) => {
      const response = await inviteApi.createInviteLink(targetType, targetId, payload);
      return response.data.data;
    },
    onSuccess: ({ invite }, variables) => {
      queryClient.setQueryData<InviteLink[]>(
        inviteLinksQueryKey(variables.targetType, variables.targetId),
        (old) => [invite, ...(old ?? []).filter((candidate) => candidate._id !== invite._id)]
      );
      queryClient.invalidateQueries({ queryKey: inviteLinksQueryKey(variables.targetType, variables.targetId) });
    },
  });
};

export const useRevokeInviteLink = () => {
  const queryClient = useQueryClient();

  return useMutation<
    InviteLink,
    unknown,
    { inviteId: string; targetType: InviteTargetType; targetId: string }
  >({
    mutationFn: async ({ inviteId }) => {
      const response = await inviteApi.revokeInviteLink(inviteId);
      return response.data.data.invite;
    },
    onSuccess: (invite, variables) => {
      queryClient.setQueryData<InviteLink[]>(
        inviteLinksQueryKey(variables.targetType, variables.targetId),
        (old) => (old ?? []).map((candidate) => (
          candidate._id === invite._id ? invite : candidate
        ))
      );
      queryClient.invalidateQueries({ queryKey: inviteLinksQueryKey(variables.targetType, variables.targetId) });
    },
  });
};

export const useJoinInviteLink = () => {
  const queryClient = useQueryClient();

  return useMutation<JoinInviteLinkResult, unknown, string>({
    mutationFn: async (token) => {
      const response = await inviteApi.joinInviteLink(token);
      return response.data.data;
    },
    onSuccess: (result) => {
      if (result.targetType === 'group') {
        queryClient.invalidateQueries({ queryKey: chatsQueryKey });
        return;
      }

      queryClient.invalidateQueries({ queryKey: spacesQueryKey });
    },
  });
};
