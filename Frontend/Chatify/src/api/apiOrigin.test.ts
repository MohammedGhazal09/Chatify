import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl, resolveOAuthUrl, resolveSocketUrl } from './apiOrigin';

const productionLocation = { origin: 'https://frontend.chatify.example.com' };
const developmentLocation = { origin: 'http://localhost:5173' };

describe('api origin resolution', () => {
  it('uses the configured production API origin by default', () => {
    expect(resolveApiBaseUrl({
      PROD: true,
      VITE_BACKEND_URL: 'https://api.chatify.example.com/',
    }, productionLocation)).toBe('https://api.chatify.example.com');
  });

  it('uses same-origin production traffic only when explicitly enabled', () => {
    expect(resolveApiBaseUrl({
      PROD: true,
      VITE_BACKEND_URL: 'https://api.chatify.example.com',
      VITE_USE_SAME_ORIGIN_API: 'true',
    }, productionLocation)).toBe(productionLocation.origin);
  });

  it('builds OAuth URLs from the selected deployment origin', () => {
    expect(resolveOAuthUrl('google', {
      PROD: true,
      VITE_BACKEND_URL: 'https://api.chatify.example.com/',
    }, productionLocation)).toBe('https://api.chatify.example.com/api/auth/google');
  });

  it('rejects insecure, credentialed, and path-bearing production API overrides', () => {
    for (const backendUrl of [
      'http://api.chatify.example.com',
      'https://user:password@api.chatify.example.com',
      'javascript:alert(1)',
      '//attacker.example',
      'https://api.chatify.example.com/private/path',
    ]) {
      expect(resolveApiBaseUrl({
        PROD: true,
        VITE_BACKEND_URL: backendUrl,
      }, productionLocation)).toBe(productionLocation.origin);
    }
  });

  it('uses an explicit secure socket origin when configured', () => {
    expect(resolveSocketUrl({
      PROD: true,
      VITE_SOCKET_URL: 'https://socket.chatify.example.com/',
      VITE_BACKEND_URL: 'https://api.chatify.example.com',
    }, productionLocation)).toBe('https://socket.chatify.example.com');
  });

  it('falls back to the configured API origin for sockets', () => {
    expect(resolveSocketUrl({
      PROD: true,
      VITE_BACKEND_URL: 'https://api.chatify.example.com',
    }, productionLocation)).toBe('https://api.chatify.example.com');
  });

  it('keeps both API and sockets same-origin when explicitly enabled', () => {
    const env = {
      PROD: true,
      VITE_BACKEND_URL: 'https://api.chatify.example.com',
      VITE_SOCKET_URL: 'https://socket.chatify.example.com',
      VITE_USE_SAME_ORIGIN_API: 'true',
    };

    expect(resolveApiBaseUrl(env, productionLocation)).toBe(productionLocation.origin);
    expect(resolveSocketUrl(env, productionLocation)).toBe(productionLocation.origin);
  });

  it('rejects insecure and credentialed socket overrides', () => {
    for (const socketUrl of [
      'http://socket.chatify.example.com',
      'https://user:password@socket.chatify.example.com',
      'data:text/html,unsafe',
      'https://socket.chatify.example.com/socket.io',
    ]) {
      expect(resolveSocketUrl({
        PROD: true,
        VITE_SOCKET_URL: socketUrl,
        VITE_BACKEND_URL: 'https://api.chatify.example.com',
      }, productionLocation)).toBe(productionLocation.origin);
    }
  });

  it('preserves the local backend fallback for development without env overrides', () => {
    expect(resolveApiBaseUrl({ PROD: false }, developmentLocation)).toBe('http://localhost:3000');
    expect(resolveSocketUrl({ PROD: false }, developmentLocation)).toBe('http://localhost:3000');
  });
});
