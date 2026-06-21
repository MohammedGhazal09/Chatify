import axiosInstance from './axios';
import type { AxiosResponse } from 'axios';
import type { IdentityMarkInput, User } from '../types/auth';
import type {
  NotificationPreferencePatch,
  NotificationPreferences,
  PushSubscriptionPayload,
} from '../types/notifications';

interface OnlineStatusResponse {
  status: string;
  data: {
    _id: string;
    username?: string;
    firstName: string;
    lastName?: string;
    profilePic?: string;
    profileBio?: string;
    profileStatus?: string;
    isOnline?: boolean;
    lastSeen?: string;
  };
}

interface OnlineUsersResponse {
  status: string;
  data: {
    onlineUsers: Array<{
      _id: string;
      username?: string;
      firstName: string;
      lastName?: string;
      profilePic?: string;
      profileBio?: string;
      profileStatus?: string;
      isOnline: boolean;
      isCallReachable?: boolean;
    }>;
    allContacts: Array<{
      _id: string;
      username?: string;
      firstName: string;
      lastName?: string;
      profilePic?: string;
      profileBio?: string;
      profileStatus?: string;
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
    showProfileStatus: boolean;
  };
}

interface AllUsersResponse {
  status: string;
  users: User[];
}

interface UserLookupResponse {
  status: string;
  data: {
    user: User;
  };
}

interface ProfileImageResponse {
  status: string;
  data: {
    user: User;
  };
}

type IdentityMarkResponse = ProfileImageResponse;
type SetUsernameResponse = ProfileImageResponse;
type ProfileResponse = ProfileImageResponse;

interface NotificationPreferencesResponse {
  status: string;
  data: {
    preferences: Omit<NotificationPreferences, 'soundEnabled' | 'browserNotificationsEnabled'>;
  };
}

interface PrivacySummaryResponse {
  status: string;
  data: {
    exportVersion: string;
    deletionRequest: {
      _id: string;
      type: 'account_deletion';
      status: 'pending' | 'completed' | 'canceled';
      requestedAt: string | null;
      completedAt?: string | null;
      scheduledFor?: string | null;
      canceledAt?: string | null;
      expiresAt?: string | null;
      recordCounts?: Record<string, number>;
      retentionSummary?: Record<string, string | null | undefined>;
    } | null;
    retentionSummary: Record<string, string | null | undefined>;
  };
}

interface PrivacyExportApiResponse {
  status: string;
  data: {
    export: Record<string, unknown>;
    audit: {
      _id: string;
      type: 'account_export';
      status: 'completed';
      recordCounts?: Record<string, number>;
    };
  };
}

interface DeletionRequestApiResponse {
  status: string;
  data: {
    deletionRequest: NonNullable<PrivacySummaryResponse['data']['deletionRequest']>;
    retentionSummary: PrivacySummaryResponse['data']['retentionSummary'];
  };
}

export const userApi = {
  getOnlineStatus: (userId: string): Promise<AxiosResponse<OnlineStatusResponse>> =>
    axiosInstance.get(`/api/user/online-status/${userId}`),

  getOnlineUsers: (): Promise<AxiosResponse<OnlineUsersResponse>> =>
    axiosInstance.get('/api/user/online-users'),

  updatePrivacySettings: (settings: {
    showOnlineStatus?: boolean;
    showLastSeen?: boolean;
    showProfileStatus?: boolean;
  }): Promise<AxiosResponse<PrivacySettingsResponse>> =>
    axiosInstance.patch('/api/user/privacy-settings', settings),

  getPrivacySummary: (): Promise<AxiosResponse<PrivacySummaryResponse>> =>
    axiosInstance.get('/api/user/privacy/summary'),

  exportAccountData: (): Promise<AxiosResponse<PrivacyExportApiResponse>> =>
    axiosInstance.post('/api/user/privacy/export', {}),

  requestAccountDeletion: (): Promise<AxiosResponse<DeletionRequestApiResponse>> =>
    axiosInstance.post('/api/user/privacy/deletion-request', {}),

  cancelAccountDeletion: (): Promise<AxiosResponse<DeletionRequestApiResponse>> =>
    axiosInstance.post('/api/user/privacy/deletion-request/cancel', {}),

  getAllUsers: (): Promise<AxiosResponse<AllUsersResponse>> =>
    axiosInstance.get('/api/user/get-all-users'),

  lookupByUsername: (username: string): Promise<AxiosResponse<UserLookupResponse>> =>
    axiosInstance.get(`/api/user/lookup/${encodeURIComponent(username)}`),

  uploadProfileImage: (file: File): Promise<AxiosResponse<ProfileImageResponse>> => {
    const formData = new FormData();
    formData.append('profileImage', file);

    return axiosInstance.patch('/api/user/profile-image', formData);
  },

  removeProfileImage: (): Promise<AxiosResponse<ProfileImageResponse>> =>
    axiosInstance.delete('/api/user/profile-image'),

  setUsername: (payload: { username: string }): Promise<AxiosResponse<SetUsernameResponse>> =>
    axiosInstance.patch('/api/user/username', payload),

  updateIdentityMark: (identityMark: IdentityMarkInput): Promise<AxiosResponse<IdentityMarkResponse>> =>
    axiosInstance.patch('/api/user/identity', identityMark),

  updateProfile: (profile: {
    profileBio?: string;
    profileStatus?: string;
  }): Promise<AxiosResponse<ProfileResponse>> =>
    axiosInstance.patch('/api/user/profile', profile),

  getNotificationPreferences: (): Promise<AxiosResponse<NotificationPreferencesResponse>> =>
    axiosInstance.get('/api/user/notification-preferences'),

  updateNotificationPreferences: (
    preferences: NotificationPreferencePatch
  ): Promise<AxiosResponse<NotificationPreferencesResponse>> =>
    axiosInstance.patch('/api/user/notification-preferences', preferences),

  registerPushSubscription: (
    subscription: PushSubscriptionPayload
  ): Promise<AxiosResponse<NotificationPreferencesResponse>> =>
    axiosInstance.post('/api/user/push-subscriptions', subscription),

  removePushSubscription: (
    endpoint: string
  ): Promise<AxiosResponse<NotificationPreferencesResponse>> =>
    axiosInstance.delete('/api/user/push-subscriptions', { data: { endpoint } }),
};
