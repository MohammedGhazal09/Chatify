import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000',
  withCredentials: true,
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalConfig = error?.config || {};
    
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