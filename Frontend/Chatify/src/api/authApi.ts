import  axiosInstance from './axios';
import type {
  ActiveSession,
  LoginData,
  LoginResponse,
  SignupData,
  TwoFactorActionResponse,
  TwoFactorBackupCodesResponse,
  TwoFactorProtectedActionData,
  TwoFactorSetupResponse,
  TwoFactorStatusResponse,
  User,
  VerifyTwoFactorLoginData,
} from '../types/auth';

export const authApi = {
  fetchCSRFToken: () => axiosInstance.get('/api/csrf-token'),
  
  checkAuth: () => axiosInstance.get<{ token: boolean }>('/api/auth/is-authenticated'),
  
  getLoggedUser: () => axiosInstance.get<{ status: string; user: User }>('/api/user/get-logged-user'),
  
  signup: (data: SignupData) => axiosInstance.post<{ success: boolean; message: string; user: User }>('/api/auth/signup', data),

  login: (data: LoginData) => axiosInstance.post<LoginResponse>('/api/auth/login', data),

  verifyTwoFactorLogin: (data: VerifyTwoFactorLoginData) => (
    axiosInstance.post<LoginResponse>('/api/auth/2fa/challenge', data)
  ),
  
  logout: () => axiosInstance.post('/api/auth/logout'),

  getActiveSessions: () => axiosInstance.get<{ status: string; data: { sessions: ActiveSession[] } }>('/api/auth/sessions'),

  revokeSession: (sessionId: string) => axiosInstance.delete<{ status: string; data: { session: ActiveSession } }>(`/api/auth/sessions/${sessionId}`),

  revokeAllSessions: () => axiosInstance.post<{ status: string; data: { revokedCount: number } }>('/api/auth/sessions/revoke-all'),

  getTwoFactorStatus: () => axiosInstance.get<TwoFactorStatusResponse>('/api/auth/2fa/status'),

  setupTwoFactor: (currentPassword: string) => (
    axiosInstance.post<TwoFactorSetupResponse>('/api/auth/2fa/setup', { currentPassword })
  ),

  confirmTwoFactor: (code: string) => (
    axiosInstance.post<TwoFactorBackupCodesResponse>('/api/auth/2fa/confirm', { code })
  ),

  disableTwoFactor: (data: TwoFactorProtectedActionData) => (
    axiosInstance.post<TwoFactorActionResponse>('/api/auth/2fa/disable', data)
  ),

  regenerateBackupCodes: (data: TwoFactorProtectedActionData) => (
    axiosInstance.post<TwoFactorBackupCodesResponse>('/api/auth/2fa/backup-codes/regenerate', data)
  ),
  
  refreshToken: () => axiosInstance.post('/api/auth/refresh-token'),

  forgotPassword: (email: string) => axiosInstance.post('/api/auth/forgot-password', { email }),

  verifyPasswordResetCode: (email: string, code: string) => axiosInstance.post('/api/auth/verify-reset-code', { email, code }),

  resetPassword: (email: string, code: string, newPassword: string) => axiosInstance.post('/api/auth/reset-password', { email, code, newPassword }),
};
