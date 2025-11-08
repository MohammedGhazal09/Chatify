import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000',
  withCredentials: true,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
});

export const initializeCsrfToken = async () => {
  try {
    await axiosInstance.get('/api/csrf-token');
    console.log('✅ CSRF token fetched');
  } catch (error) {
    console.error('❌ Failed to fetch CSRF token:', error);
  }
};

// axios automatically reads XSRF-TOKEN cookie and sends it in X-XSRF-TOKEN header

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