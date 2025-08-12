import axios from "axios";

const axiosInstance = axios.create({
  withCredentials: true,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
});

axiosInstance.interceptors.request.use((config) => {
  const method = (config.method || 'get').toUpperCase();
  const url = config.url || '';
  console.log(`[HTTP] → ${method} ${url}`);
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => {
    const method = (response.config.method || 'get').toUpperCase();
    const url = response.config.url || '';
    console.log(`[HTTP] ← ${method} ${url} ${response.status}`);
    return response;
  },
  async (error) => {
    const status = error?.response?.status;
    const code = error?.response?.data?.code;
    const originalConfig = error?.config || {};
    if (status === 403 && code === 'EBADCSRFTOKEN' && !originalConfig._retry) {
      try {
        originalConfig._retry = true;
        await axiosInstance.get('/api/csrf-token');
        return axiosInstance(originalConfig);
      } catch (err) {
        console.warn('[HTTP] × CSRF token fetch failed', err);
      }
    }
    const method = (originalConfig.method || 'get').toUpperCase();
    const url = originalConfig.url || '';
    console.warn(`[HTTP] × ${method} ${url} ${status || ''}`, error?.response?.data || error?.message);
    return Promise.reject(error);
  }
);

export default axiosInstance;