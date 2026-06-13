import { describe, expect, it } from 'vitest';
import { resolveOAuthCallbackBaseURL } from '../../Utils/oauthConfig.mjs';

describe('OAuth callback origin config', () => {
  it('uses the frontend origin for production callbacks by default', () => {
    expect(resolveOAuthCallbackBaseURL({
      NODE_ENV: 'production',
      FRONTEND_ORIGIN: 'https://chatify-ten-rho.vercel.app/',
    })).toBe('https://chatify-ten-rho.vercel.app');
  });

  it('allows an explicit callback origin override', () => {
    expect(resolveOAuthCallbackBaseURL({
      NODE_ENV: 'production',
      FRONTEND_ORIGIN: 'https://chatify-ten-rho.vercel.app',
      OAUTH_CALLBACK_ORIGIN: 'https://auth.chatify.example.com/',
    })).toBe('https://auth.chatify.example.com');
  });

  it('keeps local callbacks on the backend during development', () => {
    expect(resolveOAuthCallbackBaseURL({
      NODE_ENV: 'development',
      FRONTEND_ORIGIN_DEV: 'http://localhost:5173',
    })).toBe('http://localhost:3000');
  });
});
