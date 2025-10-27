import  axiosInstance from './axios';
import type { LoginData, SignupData, User } from '../types/auth';

export const authApi = {
  fetchCSRFToken: () => axiosInstance.get('/api/csrf-token'),
  
  checkAuth: () => axiosInstance.get<{ token: boolean }>('/api/auth/is-authenticated'),
  
  getLoggedUser: () => axiosInstance.get<{ status: string; user: User }>('/api/user/get-logged-user'),
  
  signup: (data: SignupData) => axiosInstance.post('/api/auth/signup', data),

  login: (data: LoginData) => axiosInstance.post('/api/auth/login', data),
  
  logout: () => axiosInstance.post('/api/auth/logout'),
  
  refreshToken: () => axiosInstance.post('/api/auth/refresh-token'),

  forgotPassword: (email: string) => axiosInstance.post('/api/auth/forgot-password', { email }),

  verifyPasswordResetCode: (email: string, code: string) => axiosInstance.post('/api/auth/verify-reset-code', { email, code }),

  resetPassword: (email: string, code: string, newPassword: string) => axiosInstance.post('/api/auth/reset-password', { email, code, newPassword }),
};