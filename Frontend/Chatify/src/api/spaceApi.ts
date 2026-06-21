import type { AxiosResponse } from 'axios';
import axiosInstance from './axios';
import type {
  AddSpaceMemberPayload,
  CreateSpaceChannelPayload,
  CreateSpacePayload,
  Space,
  SpaceChannel,
} from '../types/space';

interface SpaceResponse {
  status: string;
  data: {
    space: Space;
    channel?: SpaceChannel;
  };
}

interface SpacesResponse {
  status: string;
  data: {
    spaces: Space[];
  };
}

interface SpaceChannelsResponse {
  status: string;
  data: {
    channels: SpaceChannel[];
  };
}

interface SpaceChannelResponse {
  status: string;
  data: {
    channel: SpaceChannel;
  };
}

export const spaceApi = {
  getSpaces: (): Promise<AxiosResponse<SpacesResponse>> =>
    axiosInstance.get('/api/space'),

  getSpace: (spaceId: string): Promise<AxiosResponse<SpaceResponse>> =>
    axiosInstance.get(`/api/space/${spaceId}`),

  createSpace: (payload: CreateSpacePayload): Promise<AxiosResponse<SpaceResponse>> =>
    axiosInstance.post('/api/space', payload),

  addSpaceMember: (
    spaceId: string,
    payload: AddSpaceMemberPayload
  ): Promise<AxiosResponse<SpaceResponse>> =>
    axiosInstance.post(`/api/space/${spaceId}/members`, payload),

  removeSpaceMember: (spaceId: string, memberId: string): Promise<AxiosResponse<SpaceResponse>> =>
    axiosInstance.delete(`/api/space/${spaceId}/members/${memberId}`),

  getSpaceChannels: (spaceId: string): Promise<AxiosResponse<SpaceChannelsResponse>> =>
    axiosInstance.get(`/api/space/${spaceId}/channels`),

  createSpaceChannel: (
    spaceId: string,
    payload: CreateSpaceChannelPayload
  ): Promise<AxiosResponse<SpaceChannelResponse>> =>
    axiosInstance.post(`/api/space/${spaceId}/channels`, payload),
};
