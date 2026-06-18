import axiosInstance from './axios';
import type { AxiosResponse } from 'axios';
import type { IdentityMarkInput, User } from '../types/auth';

interface OnlineStatusResponse {
  status: string;
  data: {
    _id: string;
    firstName: string;
    lastName?: string;
    isOnline?: boolean;
    lastSeen?: string;
  };
}

interface OnlineUsersResponse {
  status: string;
  data: {
    onlineUsers: Array<{
      _id: string;
      firstName: string;
      lastName?: string;
      profilePic?: string;
      isOnline: boolean;
      isCallReachable?: boolean;
    }>;
    allContacts: Array<{
      _id: string;
      firstName: string;
      lastName?: string;
      profilePic?: string;
      isOnline?: boolean;
      isCallReachable?: boolean;
      lastSeen?: string;
    }>;
  };
}

interface PrivacySettingsResponse {
  status: string;
  data: {
    showOnlineStatus: boolean;
    showLastSeen: boolean;
  };
}

interface AllUsersResponse {
  status: string;
  users: User[];
}

interface ProfileImageResponse {
  status: string;
  data: {
    user: User;
  };
}

type IdentityMarkResponse = ProfileImageResponse;

export const userApi = {
  getOnlineStatus: (userId: string): Promise<AxiosResponse<OnlineStatusResponse>> =>
    axiosInstance.get(`/api/user/online-status/${userId}`),

  getOnlineUsers: (): Promise<AxiosResponse<OnlineUsersResponse>> =>
    axiosInstance.get('/api/user/online-users'),

  updatePrivacySettings: (settings: {
    showOnlineStatus?: boolean;
    showLastSeen?: boolean;
  }): Promise<AxiosResponse<PrivacySettingsResponse>> =>
    axiosInstance.patch('/api/user/privacy-settings', settings),

  getAllUsers: (): Promise<AxiosResponse<AllUsersResponse>> =>
    axiosInstance.get('/api/user/get-all-users'),

  uploadProfileImage: (file: File): Promise<AxiosResponse<ProfileImageResponse>> => {
    const formData = new FormData();
    formData.append('profileImage', file);

    return axiosInstance.patch('/api/user/profile-image', formData);
  },

  removeProfileImage: (): Promise<AxiosResponse<ProfileImageResponse>> =>
    axiosInstance.delete('/api/user/profile-image'),

  updateIdentityMark: (identityMark: IdentityMarkInput): Promise<AxiosResponse<IdentityMarkResponse>> =>
    axiosInstance.patch('/api/user/identity', identityMark),
};
