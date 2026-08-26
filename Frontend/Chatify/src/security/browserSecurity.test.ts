import { describe, expect, it } from 'vitest';

import {
  assertSafeApiRequestTarget,
  normalizeInternalAppPath,
  resolveTrustedHttpOrigin,
} from './browserSecurity';

const productionLocation = { origin: 'https://chatify.example.com' };

describe('Phase 16 browser URL security', () => {
  it('accepts only local application redirect paths', () => {
    expect(normalizeInternalAppPath('/admin/integrations?tab=active#current')).toBe(
      '/admin/integrations?tab=active#current'
    );
    expect(normalizeInternalAppPath('/invite/safe-token')).toBe('/invite/safe-token');

    for (const value of [
      'https://attacker.example/steal',
      '//attacker.example/steal',
      '\\attacker.example\\steal',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      '/chat\u0000https://attacker.example',
      '/login',
      '/signup',
      '/forgot-password',
    ]) {
      expect(normalizeInternalAppPath(value, '/')).toBe('/');
    }
  });

  it('normalizes trusted production origins and rejects insecure or credentialed overrides', () => {
    expect(resolveTrustedHttpOrigin(
      'https://api.chatify.example.com/',
      { production: true, fallbackOrigin: productionLocation.origin }
    )).toBe('https://api.chatify.example.com');

    for (const value of [
      'http://api.chatify.example.com',
      'https://user:password@api.chatify.example.com',
      'javascript:alert(1)',
      '//attacker.example',
      'https://api.chatify.example.com/path',
      'https://api.chatify.example.com/?token=secret',
    ]) {
      expect(resolveTrustedHttpOrigin(
        value,
        { production: true, fallbackOrigin: productionLocation.origin }
      )).toBe(productionLocation.origin);
    }
  });

  it('allows local HTTP origins only for loopback development', () => {
    expect(resolveTrustedHttpOrigin('http://localhost:3000', {
      production: false,
      fallbackOrigin: 'http://localhost:5173',
    })).toBe('http://localhost:3000');
    expect(resolveTrustedHttpOrigin('http://127.0.0.1:3000', {
      production: false,
      fallbackOrigin: 'http://localhost:5173',
    })).toBe('http://127.0.0.1:3000');
    expect(resolveTrustedHttpOrigin('http://api.example.com', {
      production: false,
      fallbackOrigin: 'http://localhost:5173',
    })).toBe('http://localhost:5173');
  });

  it('rejects API targets outside the configured API origin before credentials or CSRF can be sent', () => {
    const options = {
      baseURL: 'https://chatify.example.com',
      runtimeOrigin: 'https://chatify.example.com',
    };

    expect(() => assertSafeApiRequestTarget('/api/message', options)).not.toThrow();
    expect(() => assertSafeApiRequestTarget(
      'https://chatify.example.com/api/user/profile',
      options
    )).not.toThrow();

    for (const value of [
      'https://attacker.example/collect',
      '//attacker.example/collect',
      'javascript:alert(1)',
      '/outside-api',
      'https://user:password@chatify.example.com/api/message',
    ]) {
      expect(() => assertSafeApiRequestTarget(value, options)).toThrow(/unsafe api request target/i);
    }
  });
});
