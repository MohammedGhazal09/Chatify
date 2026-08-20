type RuntimeEnv = {
  PROD?: boolean;
  VITE_BACKEND_URL?: string;
  VITE_SOCKET_URL?: string;
  VITE_USE_SAME_ORIGIN_API?: string;
};

type RuntimeLocation = {
  origin: string;
};

const LOCAL_BACKEND_URL = 'http://localhost:3000';

const getRuntimeLocation = (): RuntimeLocation | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.location;
};

const cleanUrl = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : undefined;
};

const shouldUseSameOriginApi = (
  env: RuntimeEnv,
  location: RuntimeLocation | undefined
) => Boolean(env.PROD && location && env.VITE_USE_SAME_ORIGIN_API !== 'false');

export const resolveApiBaseUrl = (
  env: RuntimeEnv = import.meta.env,
  location = getRuntimeLocation()
) => {
  if (shouldUseSameOriginApi(env, location) && location) {
    return location.origin;
  }

  return cleanUrl(env.VITE_BACKEND_URL) ?? LOCAL_BACKEND_URL;
};

export const resolveSocketUrl = (
  env: RuntimeEnv = import.meta.env,
  location = getRuntimeLocation()
) => {
  if (shouldUseSameOriginApi(env, location) && location) {
    return location.origin;
  }

  const socketUrl = cleanUrl(env.VITE_SOCKET_URL);

  if (socketUrl) {
    return socketUrl;
  }

  return resolveApiBaseUrl(env, location);
};

export const resolveOAuthUrl = (
  provider: 'google' | 'github' | 'discord',
  env: RuntimeEnv = import.meta.env,
  location = getRuntimeLocation()
) => `${resolveApiBaseUrl(env, location)}/api/auth/${provider}`;
