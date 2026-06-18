export type IdentityMarkSource = 'custom' | 'fallback';
export type IdentityMarkPaletteId = 'teal' | 'indigo' | 'amber' | 'slate' | 'rose';
export type IdentityMarkPatternId = 'rings' | 'grid' | 'diagonal' | 'orbit' | 'mono';
export type IdentityMarkAccentId = 'mint' | 'sky' | 'gold' | 'coral' | 'graphite';

export interface IdentityMark {
  source?: IdentityMarkSource;
  label: string;
  initials: string;
  paletteId: IdentityMarkPaletteId;
  patternId: IdentityMarkPatternId;
  accentId: IdentityMarkAccentId;
  updatedAt?: string | null;
}

export interface IdentityMarkInput {
  label: string;
  initials: string;
  paletteId: IdentityMarkPaletteId;
  patternId: IdentityMarkPatternId;
  accentId: IdentityMarkAccentId;
}

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  username?: string;
  profilePic?: string;
  identityMark?: IdentityMark;
  identityMarkUpdatedAt?: string | null;
  authProvider: 'local' | 'google' | 'github' | 'discord';
  isVerified: boolean;
  // Online status fields
  isOnline?: boolean;
  lastSeen?: string;
  showOnlineStatus?: boolean;
  showLastSeen?: boolean;
}

export interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupData {
  firstName: string;
  lastName: string;
  username: string;
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
