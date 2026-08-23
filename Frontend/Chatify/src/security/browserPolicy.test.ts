import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readProjectFile = (relativePath: string) => readFileSync(
  resolve(process.cwd(), relativePath),
  'utf8'
);

const getVercelHeaders = () => {
  const vercel = JSON.parse(readProjectFile('vercel.json')) as {
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
    const html = readProjectFile('index.html');

    expect(html).not.toMatch(/<script[^>]+src=["']https?:\/\//i);
    expect(html).not.toContain('cdnflow.co');
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
    const viteConfig = readProjectFile('vite.config.ts');

    expect(viteConfig).toMatch(/build\s*:\s*\{[\s\S]*sourcemap\s*:\s*false/);
  });
});
