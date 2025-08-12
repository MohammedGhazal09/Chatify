import axiosInstance from "./index";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export async function fetchCsrfToken(): Promise<void> {
  await axiosInstance.get('/api/csrf-token');
}

export async function login(payload: LoginPayload): Promise<void> {
  await axiosInstance.post('/api/auth/login', payload);
}

export async function signup(payload: SignupPayload): Promise<void> {
  await axiosInstance.post('/api/auth/signup', payload);
}

export async function logout(): Promise<void> {
  await axiosInstance.post('/api/auth/logout');
}



