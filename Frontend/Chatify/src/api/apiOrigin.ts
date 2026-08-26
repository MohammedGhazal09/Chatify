import { resolveTrustedHttpOrigin } from '../security/browserSecurity';

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

const shouldUseSameOriginApi = (
  env: RuntimeEnv,
  location: RuntimeLocation | undefined
) => Boolean(env.PROD && location && env.VITE_USE_SAME_ORIGIN_API === 'true');

const getFallbackOrigin = (
  env: RuntimeEnv,
  location: RuntimeLocation | undefined
) => env.PROD
  ? location?.origin ?? 'https://localhost'
  : LOCAL_BACKEND_URL;

const resolveConfiguredOrigin = (
  value: unknown,
  env: RuntimeEnv,
  location: RuntimeLocation | undefined,
  fallbackOrigin = getFallbackOrigin(env, location)
) => resolveTrustedHttpOrigin(value, {
  production: Boolean(env.PROD),
  fallbackOrigin,
});

export const resolveApiBaseUrl = (
  env: RuntimeEnv = import.meta.env,
  location = getRuntimeLocation()
) => {
  const fallbackOrigin = getFallbackOrigin(env, location);

  if (shouldUseSameOriginApi(env, location) && location) {
    return resolveConfiguredOrigin(location.origin, env, location, fallbackOrigin);
  }

  return resolveConfiguredOrigin(env.VITE_BACKEND_URL, env, location, fallbackOrigin);
};

export const resolveSocketUrl = (
  env: RuntimeEnv = import.meta.env,
  location = getRuntimeLocation()
) => {
  const fallbackOrigin = getFallbackOrigin(env, location);

  if (shouldUseSameOriginApi(env, location) && location) {
    return resolveConfiguredOrigin(location.origin, env, location, fallbackOrigin);
  }

  if (typeof env.VITE_SOCKET_URL === 'string' && env.VITE_SOCKET_URL.trim()) {
    return resolveConfiguredOrigin(env.VITE_SOCKET_URL, env, location, fallbackOrigin);
  }

  return resolveApiBaseUrl(env, location);
};

export const resolveOAuthUrl = (
  provider: 'google' | 'github' | 'discord',
  env: RuntimeEnv = import.meta.env,
  location = getRuntimeLocation()
) => `${resolveApiBaseUrl(env, location)}/api/auth/${provider}`;
