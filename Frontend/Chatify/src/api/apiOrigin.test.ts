import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl, resolveOAuthUrl, resolveSocketUrl } from './apiOrigin';

const vercelLocation = { origin: 'https://chatify-ten-rho.vercel.app' };

describe('api origin resolution', () => {
  it('uses same-origin production traffic even when a stale backend URL env var exists', () => {
    const baseUrl = resolveApiBaseUrl({
      PROD: true,
      VITE_BACKEND_URL: 'https://chatify-ckmn.onrender.com',
    }, vercelLocation);

    expect(baseUrl).toBe('https://chatify-ten-rho.vercel.app');
  });

  it('builds OAuth URLs through the same-origin proxy in production', () => {
    expect(resolveOAuthUrl('google', {
      PROD: true,
      VITE_BACKEND_URL: 'https://chatify-ckmn.onrender.com/',
    }, vercelLocation)).toBe('https://chatify-ten-rho.vercel.app/api/auth/google');
  });

  it('allows an explicit cross-origin API opt-out', () => {
    expect(resolveApiBaseUrl({
      PROD: true,
      VITE_BACKEND_URL: 'https://api.chatify.example.com/',
      VITE_USE_SAME_ORIGIN_API: 'false',
    }, vercelLocation)).toBe('https://api.chatify.example.com');
  });

  it('uses an explicit socket URL before the API origin', () => {
    expect(resolveSocketUrl({
      PROD: true,
      VITE_SOCKET_URL: 'https://socket.chatify.example.com/',
      VITE_BACKEND_URL: 'https://api.chatify.example.com',
    }, vercelLocation)).toBe('https://socket.chatify.example.com');
  });

  it('uses the same-origin socket endpoint by default in production', () => {
    expect(resolveSocketUrl({
      PROD: true,
      VITE_BACKEND_URL: 'https://chatify-ckmn.onrender.com',
    }, vercelLocation)).toBe('https://chatify-ten-rho.vercel.app');
  });
});
