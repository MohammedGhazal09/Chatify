// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const readProjectFile = (relativePath: string) => readFileSync(
  new URL(`../../${relativePath}`, import.meta.url),
  'utf8',
);

describe('frontend deployment security', () => {
  it('does not load globally privileged third-party scripts', () => {
    const html = readProjectFile('index.html');

    expect(html).not.toMatch(/<script[^>]+src=["']https?:\/\//i);
    expect(html).not.toContain('cdnflow.co');
  });

  it('defines browser isolation and transport security headers', () => {
    const config = JSON.parse(readProjectFile('vercel.json')) as {
      headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };
    const headerMap = new Map(
      (config.headers?.find((entry) => entry.source === '/(.*)')?.headers ?? [])
        .map((header) => [header.key.toLowerCase(), header.value]),
    );

    expect(headerMap.get('content-security-policy')).toContain("default-src 'self'");
    expect(headerMap.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(headerMap.get('x-frame-options')).toBe('DENY');
    expect(headerMap.get('x-content-type-options')).toBe('nosniff');
    expect(headerMap.get('referrer-policy')).toBeTruthy();
    expect(headerMap.get('permissions-policy')).toBeTruthy();
    expect(headerMap.get('strict-transport-security')).toContain('max-age=');
  });

  it('keeps notification click navigation on the Chatify origin', async () => {
    const listeners = new Map<string, (event: any) => void>();
    const navigate = vi.fn(async () => null);
    const focus = vi.fn(async () => undefined);
    const openWindow = vi.fn(async () => undefined);
    const context = {
      URL,
      self: {
        location: { origin: 'https://chatify.example' },
        addEventListener: (name: string, listener: (event: any) => void) => listeners.set(name, listener),
        registration: { showNotification: vi.fn() },
        clients: {
          matchAll: vi.fn(async () => [{ navigate, focus }]),
          openWindow,
        },
      },
    };

    runInNewContext(readProjectFile('public/chatify-service-worker.js'), context);
    const clickHandler = listeners.get('notificationclick');
    expect(clickHandler).toBeTypeOf('function');
    let completion: Promise<unknown> | undefined;

    clickHandler?.({
      notification: {
        close: vi.fn(),
        data: { url: 'https://attacker.example/phish' },
      },
      waitUntil: (promise: Promise<unknown>) => { completion = promise; },
    });
    await completion;

    expect(navigate).toHaveBeenCalledWith('/chat');
    expect(openWindow).not.toHaveBeenCalledWith('https://attacker.example/phish');
  });
});
