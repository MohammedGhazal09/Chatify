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
  email?: string;
  username?: string;
  profilePic?: string;
  profileBio?: string;
  profileStatus?: string;
  role?: 'user' | 'admin';
  identityMark?: IdentityMark;
  identityMarkUpdatedAt?: string | null;
  authProvider: 'local' | 'google' | 'github' | 'discord';
  isVerified: boolean;
  twoFactorEnabled?: boolean;
  // Online status fields
  isOnline?: boolean;
  lastSeen?: string;
  showOnlineStatus?: boolean;
  showLastSeen?: boolean;
  showProfileStatus?: boolean;
}

export interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface TwoFactorChallengeData {
  twoFactorRequired: true;
  challengeToken: string;
  expiresAt: string;
}

export interface LoginSuccessResponse {
  status: 'success';
  message: string;
}

export interface LoginTwoFactorRequiredResponse {
  status: 'mfa_required';
  message: string;
  data: TwoFactorChallengeData;
}

export type LoginResponse = LoginSuccessResponse | LoginTwoFactorRequiredResponse;

export interface VerifyTwoFactorLoginData {
  challengeToken: string;
  code: string;
}

export interface TwoFactorStatus {
  enabled: boolean;
  available: boolean;
  backupCodesRemaining: number;
  pendingSetup: boolean;
}

export interface TwoFactorStatusResponse {
  status: string;
  data: {
    twoFactor: TwoFactorStatus;
  };
}

export interface TwoFactorSetupData {
  secret: string;
  otpauthUrl: string;
  expiresAt: string;
}

export interface TwoFactorSetupResponse {
  status: string;
  data: {
    setup: TwoFactorSetupData;
    twoFactor: TwoFactorStatus;
  };
}

export interface TwoFactorBackupCodesResponse {
  status: string;
  data: {
    backupCodes: string[];
    twoFactor: TwoFactorStatus;
  };
}

export interface TwoFactorActionResponse {
  status: string;
  data: {
    twoFactor: TwoFactorStatus;
  };
}

export interface TwoFactorProtectedActionData {
  currentPassword: string;
  code: string;
}

export interface SignupData {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
}

export interface ActiveSession {
  id: string;
  current: boolean;
  deviceLabel: string;
  rememberMe: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
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
