import type { AxiosResponse } from 'axios';
import axiosInstance from './axios';
import type {
  CreateInviteLinkPayload,
  CreateInviteLinkResult,
  InviteLink,
  InviteTargetType,
  JoinInviteLinkResult,
} from '../types/invite';

interface InviteLinkResponse {
  status: string;
  data: {
    invite: InviteLink;
  };
}

interface CreateInviteLinkResponse {
  status: string;
  data: CreateInviteLinkResult;
}

interface InviteLinksResponse {
  status: string;
  data: {
    invites: InviteLink[];
  };
}

interface JoinInviteLinkResponse {
  status: string;
  data: JoinInviteLinkResult;
}

const getTargetPath = (targetType: InviteTargetType, targetId: string) => (
  targetType === 'group'
    ? `/api/invite/group/${targetId}`
    : `/api/invite/space/${targetId}`
);

export const inviteApi = {
  createInviteLink: (
    targetType: InviteTargetType,
    targetId: string,
    payload: CreateInviteLinkPayload
  ): Promise<AxiosResponse<CreateInviteLinkResponse>> =>
    axiosInstance.post(getTargetPath(targetType, targetId), payload),

  listInviteLinks: (
    targetType: InviteTargetType,
    targetId: string
  ): Promise<AxiosResponse<InviteLinksResponse>> =>
    axiosInstance.get(getTargetPath(targetType, targetId)),

  revokeInviteLink: (inviteId: string): Promise<AxiosResponse<InviteLinkResponse>> =>
    axiosInstance.delete(`/api/invite/${inviteId}`),

  joinInviteLink: (token: string): Promise<AxiosResponse<JoinInviteLinkResponse>> =>
    axiosInstance.post(`/api/invite/join/${encodeURIComponent(token)}`),
};
