import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import axiosInstance from '../api';
import type { User, SignupData, LoginData } from '../types/auth';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isOAuthLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setOAuthLoading: (loading: boolean) => void;
  checkAuthStatus: (check?: boolean, signal?: AbortSignal) => Promise<void>;
  signup: (userData: SignupData) => Promise<void>;
  login: (userData: LoginData) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      user: null,
      isLoading: false,
      isOAuthLoading: false,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setLoading: (loading) => set({ isLoading: loading }),
      setOAuthLoading: (loading) => set({ isOAuthLoading: loading }),

      checkAuthStatus: async (check = false, signal) => {
        try {
          if (check) {
            const { data } = await axiosInstance.get('/api/auth/is-authenticated', { signal });
            if (!data.token) {
              set({ user: null, isAuthenticated: false });
              return;
            }
          }
          
          const response = await axiosInstance.get('/api/user/get-logged-user', { signal });
          set({ user: response.data.user, isAuthenticated: true });
        } catch (err) {
          console.error('Auth check failed:', err);
          set({ user: null, isAuthenticated: false });
        }
      },

      signup: async (userData) => {
        set({ isLoading: true });
        try {
          await axiosInstance.post('/api/auth/signup', userData);
          await get().checkAuthStatus();
        } catch (err) {
          set({ user: null, isAuthenticated: false });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      login: async (userData) => {
        set({ isLoading: true });
        try {
          await axiosInstance.post('/api/auth/login', userData);
          await get().checkAuthStatus();
        } catch (err) {
          set({ user: null, isAuthenticated: false });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await axiosInstance.post('/api/auth/logout');
        } catch (err) {
          console.error('Logout error:', err);
          throw err;
        } finally {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      initializeAuth: async () => {
        // Check for OAuth redirect
        const isOAuthRedirect = localStorage.getItem('oauth-pending');
        if (isOAuthRedirect) {
          set({ isOAuthLoading: true });
        }

        set({ isLoading: true });
        try {
          // Ensure CSRF token
          if (!localStorage.getItem('Visited')) {
            await axiosInstance.get('/api/csrf-token');
            localStorage.setItem('Visited', 'true');
          }
          await get().checkAuthStatus(true);
        } catch (err) {
          console.error('Auth initialization failed:', err);
        } finally {
          set({ isLoading: false, isOAuthLoading: false });
          localStorage.removeItem('oauth-pending');
        }
      },
    }),
    {
      name: 'auth-store',
    }
  )
);

export default useAuthStore;