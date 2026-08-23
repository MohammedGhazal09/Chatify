import { describe, expect, it } from 'vitest';

import applicationDocument from '../../index.html?raw';
import deploymentConfig from '../../vercel.json?raw';
import viteConfiguration from '../../vite.config.ts?raw';

const getVercelHeaders = () => {
  const vercel = JSON.parse(deploymentConfig) as {
    headers?: Array<{
      source: string;
      headers: Array<{ key: string; value: string }>;
    }>;
  };
  const rule = vercel.headers?.find((entry) => entry.source === '/(.*)');
  return new Map(rule?.headers.map((header) => [header.key.toLowerCase(), header.value]) ?? []);
};

describe('Phase 16 deployed browser policy', () => {
  it('does not execute unpinned third-party scripts from the application document', () => {
    expect(applicationDocument).not.toMatch(/<script[^>]+src=["']https?:\/\//i);
    expect(applicationDocument).not.toContain('cdnflow.co');
  });

  it('deploys a restrictive CSP and browser isolation headers', () => {
    const headers = getVercelHeaders();
    const csp = headers.get('content-security-policy') ?? '';

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain('cdnflow.co');
    expect(headers.get('x-frame-options')).toBe('DENY');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('referrer-policy')).toBe('no-referrer');
    expect(headers.get('cross-origin-opener-policy')).toBe('same-origin');
    expect(headers.get('permissions-policy')).toContain('camera=(self)');
    expect(headers.get('permissions-policy')).toContain('microphone=(self)');
  });

  it('keeps production source maps explicitly disabled', () => {
    expect(viteConfiguration).toMatch(/build\s*:\s*\{[\s\S]*sourcemap\s*:\s*false/);
  });
});
