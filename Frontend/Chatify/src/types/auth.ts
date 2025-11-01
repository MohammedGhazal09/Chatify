export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePic?: string;
  authProvider: 'local' | 'google' | 'github' | 'discord';
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

// export interface AuthContextType {
//   user: User | null;
//   // isLoading: boolean;
//   // setIsLoading: (loading: boolean) => void;
//   isAuthenticated: boolean;
//   login: (userData: LoginData) => Promise<Error | null | void>;
//   signup: (userData: SignupData) => Promise<Error | null | void>;
//   logout: () => Promise<Error | null | void>;
// }