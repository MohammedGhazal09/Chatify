export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePic?: string;
  authProvider: 'local' | 'google' | 'github' | 'linkedIn';
  isVerified: boolean;
}

export interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (userData: LoginData) => Promise<void>;
  signup: (userData: SignupData) => Promise<void>;
  logout: () => Promise<void>;
}