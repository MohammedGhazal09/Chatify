const cleanUrl = (value) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : undefined;
};

const DEFAULT_PUBLIC_BACKEND_URL = 'https://chatify-ckmn.onrender.com';
const DEFAULT_FRONTEND_URL = 'https://chatify-ten-rho.vercel.app';

export const resolveOAuthCallbackBaseURL = (env = process.env) => {
  if (env.NODE_ENV !== 'production') {
    return cleanUrl(env.OAUTH_CALLBACK_ORIGIN) || 'http://localhost:3000';
  }

  return cleanUrl(env.OAUTH_CALLBACK_ORIGIN)
    || cleanUrl(env.PUBLIC_BACKEND_URL)
    || DEFAULT_PUBLIC_BACKEND_URL;
};

export const resolveOAuthFinalizeBaseURL = (env = process.env) => {
  if (env.NODE_ENV !== 'production') {
    return cleanUrl(env.FRONTEND_ORIGIN_DEV) || 'http://localhost:5173';
  }

  return cleanUrl(env.FRONTEND_ORIGIN) || DEFAULT_FRONTEND_URL;
};
