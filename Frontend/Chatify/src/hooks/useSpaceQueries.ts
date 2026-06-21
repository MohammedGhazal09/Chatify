import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { spaceApi } from '../api/spaceApi';
import { useAuthStore } from '../store/authstore';
import type {
  AddSpaceMemberPayload,
  CreateSpaceChannelPayload,
  CreateSpacePayload,
  Space,
  SpaceChannel,
} from '../types/space';

export const spacesQueryKey = ['spaces'] as const;
export const spaceQueryKey = (spaceId: string) => ['spaces', spaceId] as const;
export const spaceChannelsQueryKey = (spaceId: string) => ['spaces', spaceId, 'channels'] as const;

type CreateSpaceResult = {
  space: Space;
  channel?: SpaceChannel;
};

const normalizeSpaceChannel = (channel: SpaceChannel): SpaceChannel => ({
  ...channel,
  unReadMessages: channel.unReadMessages ?? 0,
  encryptionMode: channel.encryptionMode ?? 'standard',
  conversationControls: {
    isDirectChat: false,
    peerId: null,
    canSendMessage: true,
    canBlockUser: false,
    canUnblockUser: false,
    blockedByMe: false,
    blockedMe: false,
    messagingDisabledReason: null,
    ...channel.conversationControls,
  },
});

const normalizeSpace = (space: Space): Space => ({
  ...space,
  channels: space.channels?.map(normalizeSpaceChannel),
});

const sortSpaces = (spaces: Space[]) => [...spaces].sort((left, right) => {
  const timeDelta = Date.parse(right.updatedAt ?? '') - Date.parse(left.updatedAt ?? '');

  if (Number.isFinite(timeDelta) && timeDelta !== 0) {
    return timeDelta;
  }

  return left._id.localeCompare(right._id);
});

const upsertSpaceInCache = (queryClient: QueryClient, space: Space) => {
  const normalizedSpace = normalizeSpace(space);

  queryClient.setQueryData<Space[]>(spacesQueryKey, (old) => {
    if (!old) {
      return [normalizedSpace];
    }

    return sortSpaces([
      normalizedSpace,
      ...old.filter((candidate) => candidate._id !== normalizedSpace._id),
    ]);
  });
  queryClient.setQueryData(spaceQueryKey(normalizedSpace._id), normalizedSpace);

  if (normalizedSpace.channels) {
    queryClient.setQueryData<SpaceChannel[]>(
      spaceChannelsQueryKey(normalizedSpace._id),
      normalizedSpace.channels
    );
  }
};

const upsertChannelInCache = (
  queryClient: QueryClient,
  spaceId: string,
  channel: SpaceChannel
) => {
  const normalizedChannel = normalizeSpaceChannel(channel);

  queryClient.setQueryData<SpaceChannel[]>(spaceChannelsQueryKey(spaceId), (old) => {
    if (!old) {
      return [normalizedChannel];
    }

    return [
      ...old.filter((candidate) => candidate._id !== normalizedChannel._id),
      normalizedChannel,
    ].sort((left, right) => (
      Date.parse(left.createdAt ?? '') - Date.parse(right.createdAt ?? '') ||
      left._id.localeCompare(right._id)
    ));
  });

  queryClient.setQueryData<Space[]>(spacesQueryKey, (old) => old?.map((space) => {
    if (space._id !== spaceId) {
      return space;
    }

    const currentChannels = space.channels ?? [];
    return {
      ...space,
      channels: [
        ...currentChannels.filter((candidate) => candidate._id !== normalizedChannel._id),
        normalizedChannel,
      ],
    };
  }));
};

export const useSpaces = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: spacesQueryKey,
    queryFn: async () => {
      const response = await spaceApi.getSpaces();
      return response.data.data.spaces.map(normalizeSpace);
    },
    enabled: isAuthenticated,
  });
};

export const useSpaceChannels = (spaceId: string | null) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: spaceChannelsQueryKey(spaceId ?? ''),
    queryFn: async () => {
      if (!spaceId) {
        return [];
      }

      const response = await spaceApi.getSpaceChannels(spaceId);
      return response.data.data.channels.map(normalizeSpaceChannel);
    },
    enabled: Boolean(spaceId && isAuthenticated),
  });
};

export const useCreateSpace = () => {
  const queryClient = useQueryClient();

  return useMutation<CreateSpaceResult, unknown, CreateSpacePayload>({
    mutationFn: async (payload) => {
      const response = await spaceApi.createSpace(payload);
      return {
        space: normalizeSpace(response.data.data.space),
        channel: response.data.data.channel
          ? normalizeSpaceChannel(response.data.data.channel)
          : undefined,
      };
    },
    onSuccess: ({ space, channel }) => {
      const nextSpace = channel && !space.channels?.some((candidate) => candidate._id === channel._id)
        ? { ...space, channels: [...(space.channels ?? []), channel] }
        : space;

      upsertSpaceInCache(queryClient, nextSpace);
      if (channel) {
        upsertChannelInCache(queryClient, nextSpace._id, channel);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: spacesQueryKey });
    },
  });
};

export const useCreateSpaceChannel = () => {
  const queryClient = useQueryClient();

  return useMutation<SpaceChannel, unknown, { spaceId: string; payload: CreateSpaceChannelPayload }>({
    mutationFn: async ({ spaceId, payload }) => {
      const response = await spaceApi.createSpaceChannel(spaceId, payload);
      return normalizeSpaceChannel(response.data.data.channel);
    },
    onSuccess: (channel, variables) => {
      upsertChannelInCache(queryClient, variables.spaceId, channel);
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: spaceChannelsQueryKey(variables.spaceId) });
      queryClient.invalidateQueries({ queryKey: spacesQueryKey });
    },
  });
};

export const useAddSpaceMember = () => {
  const queryClient = useQueryClient();

  return useMutation<Space, unknown, { spaceId: string; payload: AddSpaceMemberPayload }>({
    mutationFn: async ({ spaceId, payload }) => {
      const response = await spaceApi.addSpaceMember(spaceId, payload);
      return normalizeSpace(response.data.data.space);
    },
    onSuccess: (space) => {
      upsertSpaceInCache(queryClient, space);
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: spaceChannelsQueryKey(variables.spaceId) });
      queryClient.invalidateQueries({ queryKey: spacesQueryKey });
    },
  });
};

export const useRemoveSpaceMember = () => {
  const queryClient = useQueryClient();

  return useMutation<Space, unknown, { spaceId: string; memberId: string }>({
    mutationFn: async ({ spaceId, memberId }) => {
      const response = await spaceApi.removeSpaceMember(spaceId, memberId);
      return normalizeSpace(response.data.data.space);
    },
    onSuccess: (space) => {
      upsertSpaceInCache(queryClient, space);
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: spaceChannelsQueryKey(variables.spaceId) });
      queryClient.invalidateQueries({ queryKey: spacesQueryKey });
    },
  });
};
