import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000',
  withCredentials: true,
});

export const initializeCsrfToken = async () => {
  try {
    await axiosInstance.get('/api/csrf-token');
    console.log('✅ CSRF token fetched');
    console.log('🍪 All cookies:', document.cookie);
  } catch (error) {
    console.error('❌ Failed to fetch CSRF token:', error);
  }
};

axiosInstance.interceptors.request.use((config) => {
  // Read cookie manually
  const cookies = document.cookie.split('; ');
  console.log('📋 Cookies:', cookies);
  
  const csrfCookie = cookies.find(c => c.startsWith('XSRF-TOKEN='));
  const token = csrfCookie?.split('=')[1];
  
  console.log('🔑 CSRF Token:', token);
  
  if (token && config.url !== '/api/csrf-token') {
    config.headers['X-XSRF-TOKEN'] = decodeURIComponent(token);
  }
  
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const code = error?.response?.data?.code;
    const originalConfig = error?.config || {};
    
    // CSRF error: fetch a fresh token and retry once
    if (status === 403 && code === 'EBADCSRFTOKEN' && !originalConfig._retry) {
      try {
        originalConfig._retry = true;
        await axiosInstance.get('/api/csrf-token');
        return axiosInstance(originalConfig);
      } catch {
        return Promise.reject(error);
      }
    }
    // unauthenticated, refresh token and retry once
    if (status === 401 && !originalConfig._retry && !originalConfig.url?.includes('/refresh-token')) {
      try {
        originalConfig._retry = true;
        await axiosInstance.post('/api/auth/refresh-token');
        return axiosInstance(originalConfig);
      } catch {
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;