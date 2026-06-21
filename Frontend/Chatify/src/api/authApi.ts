import  axiosInstance from './axios';
import type { ActiveSession, LoginData, SignupData, User } from '../types/auth';

export const authApi = {
  fetchCSRFToken: () => axiosInstance.get('/api/csrf-token'),
  
  checkAuth: () => axiosInstance.get<{ token: boolean }>('/api/auth/is-authenticated'),
  
  getLoggedUser: () => axiosInstance.get<{ status: string; user: User }>('/api/user/get-logged-user'),
  
  signup: (data: SignupData) => axiosInstance.post<{ success: boolean; message: string; user: User }>('/api/auth/signup', data),

  login: (data: LoginData) => axiosInstance.post('/api/auth/login', data),
  
  logout: () => axiosInstance.post('/api/auth/logout'),

  getActiveSessions: () => axiosInstance.get<{ status: string; data: { sessions: ActiveSession[] } }>('/api/auth/sessions'),

  revokeSession: (sessionId: string) => axiosInstance.delete<{ status: string; data: { session: ActiveSession } }>(`/api/auth/sessions/${sessionId}`),

  revokeAllSessions: () => axiosInstance.post<{ status: string; data: { revokedCount: number } }>('/api/auth/sessions/revoke-all'),
  
  refreshToken: () => axiosInstance.post('/api/auth/refresh-token'),

  forgotPassword: (email: string) => axiosInstance.post('/api/auth/forgot-password', { email }),

  verifyPasswordResetCode: (email: string, code: string) => axiosInstance.post('/api/auth/verify-reset-code', { email, code }),

  resetPassword: (email: string, code: string, newPassword: string) => axiosInstance.post('/api/auth/reset-password', { email, code, newPassword }),
};
