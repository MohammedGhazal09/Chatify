const cleanUrl = (value) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : undefined;
};

export const resolveOAuthCallbackBaseURL = (env = process.env) => {
  if (env.NODE_ENV !== 'production') {
    return cleanUrl(env.OAUTH_CALLBACK_ORIGIN) || 'http://localhost:3000';
  }

  return cleanUrl(env.OAUTH_CALLBACK_ORIGIN)
    || cleanUrl(env.PUBLIC_BACKEND_URL)
    || cleanUrl(env.FRONTEND_ORIGIN)
    || 'https://chatify-ten-rho.vercel.app';
};
