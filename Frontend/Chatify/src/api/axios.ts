import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000',
  withCredentials: true,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
});

axiosInstance.interceptors.request.use((config) => {
  const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('_csrf='))
    ?.split('=')[1];
  
  if (csrfToken) {
    // Use lowercase header name
    config.headers['x-csrf-token'] = decodeURIComponent(csrfToken);
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