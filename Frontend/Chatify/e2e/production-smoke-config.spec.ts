import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import { getProductionSmokeConfig } from './pages/productionSmoke';
import {
  findPhase14StaticContentLeaks,
  getPhase14LiveAcceptancePath,
  getPhase14ProductionAcceptanceConfig,
  phase14UrlMatchesAcceptedOrigin,
  phase14UrlMatchesBackendOrigin,
  writePhase14BlockedSetupReport,
} from './pages/phase14ProductionAcceptance';

const smokeEnvKeys = [
  'CHATIFY_PRODUCTION_SMOKE',
  'CHATIFY_PROD_FRONTEND_URL',
  'CHATIFY_PROD_BACKEND_URL',
  'CHATIFY_SMOKE_USER_A_EMAIL',
  'CHATIFY_SMOKE_USER_A_USERNAME',
  'CHATIFY_SMOKE_USER_A_PASSWORD',
  'CHATIFY_SMOKE_USER_B_EMAIL',
  'CHATIFY_SMOKE_USER_B_USERNAME',
  'CHATIFY_SMOKE_USER_B_PASSWORD',
] as const;

type SmokeEnvKey = typeof smokeEnvKeys[number];

const withSmokeEnv = async (
  values: Record<SmokeEnvKey, string>,
  callback: () => Promise<void> | void
) => {
  const originalEnv = new Map(smokeEnvKeys.map((key) => [key, process.env[key]]));

  try {
    smokeEnvKeys.forEach((key) => {
      process.env[key] = values[key];
    });

    await callback();
  } finally {
    smokeEnvKeys.forEach((key) => {
      const originalValue = originalEnv.get(key);

      if (originalValue === undefined) {
        delete process.env[key];
        return;
      }

      process.env[key] = originalValue;
    });
  }
};

const validSmokeEnv: Record<SmokeEnvKey, string> = {
  CHATIFY_PRODUCTION_SMOKE: '1',
  CHATIFY_PROD_FRONTEND_URL: 'https://chatify-ten-rho.vercel.app',
  CHATIFY_PROD_BACKEND_URL: 'https://chatify-ckmn.onrender.com',
  CHATIFY_SMOKE_USER_A_EMAIL: 'sender@example.test',
  CHATIFY_SMOKE_USER_A_USERNAME: 'sender.smoke',
  CHATIFY_SMOKE_USER_A_PASSWORD: 'example-secret-a',
  CHATIFY_SMOKE_USER_B_EMAIL: 'recipient@example.test',
  CHATIFY_SMOKE_USER_B_USERNAME: 'recipient.smoke',
  CHATIFY_SMOKE_USER_B_PASSWORD: 'example-secret-b',
};

const missingSmokeEnv: Record<SmokeEnvKey, string> = {
  CHATIFY_PRODUCTION_SMOKE: '',
  CHATIFY_PROD_FRONTEND_URL: '',
  CHATIFY_PROD_BACKEND_URL: '',
  CHATIFY_SMOKE_USER_A_EMAIL: '',
  CHATIFY_SMOKE_USER_A_USERNAME: '',
  CHATIFY_SMOKE_USER_A_PASSWORD: '',
  CHATIFY_SMOKE_USER_B_EMAIL: '',
  CHATIFY_SMOKE_USER_B_USERNAME: '',
  CHATIFY_SMOKE_USER_B_PASSWORD: '',
};

test.describe('Phase 10 production smoke config', () => {
  test('blocks invalid production URLs instead of falling back to defaults', async () => {
    await withSmokeEnv(
      {
        ...validSmokeEnv,
        CHATIFY_PROD_FRONTEND_URL: 'not-a-url',
      },
      () => {
        const config = getProductionSmokeConfig();

        expect(config.enabled).toBe(false);

        if (!config.enabled) {
          expect(config.blockedReason).toContain('CHATIFY_PROD_FRONTEND_URL');
          expect(config.metadata.invalidUrlEnv).toEqual(['CHATIFY_PROD_FRONTEND_URL']);
        }
      }
    );
  });

  test('normalizes valid production URLs for an opted-in smoke run', async () => {
    await withSmokeEnv(
      {
        ...validSmokeEnv,
        CHATIFY_PROD_FRONTEND_URL: 'https://chatify-ten-rho.vercel.app/path#fragment',
        CHATIFY_PROD_BACKEND_URL: 'https://chatify-ckmn.onrender.com/',
      },
      () => {
        const config = getProductionSmokeConfig();

        expect(config.enabled).toBe(true);

        if (config.enabled) {
          expect(config.frontendUrl).toBe('https://chatify-ten-rho.vercel.app/path');
          expect(config.backendUrl).toBe('https://chatify-ckmn.onrender.com');
          expect(config.metadata.invalidUrlEnv).toEqual([]);
        }
      }
    );
  });
});

test.describe('Phase 14 production smoke config', () => {
  test('proxies the bare Socket.IO endpoint before the SPA fallback', () => {
    const vercelConfig = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    const rewrites = vercelConfig.rewrites as Array<{ source: string; destination: string }>;
    const rewriteSources = rewrites.map((rewrite) => rewrite.source);

    expect(rewrites).toEqual(
      expect.arrayContaining([
        {
          source: '/socket.io',
          destination: 'https://chatify-ckmn.onrender.com/socket.io',
        },
        {
          source: '/socket.io/',
          destination: 'https://chatify-ckmn.onrender.com/socket.io/',
        },
        {
          source: '/socket.io/:path*',
          destination: 'https://chatify-ckmn.onrender.com/socket.io/:path*',
        },
      ])
    );
    expect(rewriteSources.indexOf('/socket.io')).toBeLessThan(rewriteSources.indexOf('/(.*)'));
    expect(rewriteSources.indexOf('/socket.io/')).toBeLessThan(rewriteSources.indexOf('/(.*)'));
    expect(rewriteSources.indexOf('/socket.io/:path*')).toBeLessThan(rewriteSources.indexOf('/(.*)'));
  });

  test('blocks missing Phase 14 env without default production URL fallback', async () => {
    await withSmokeEnv(
      missingSmokeEnv,
      () => {
        const config = getPhase14ProductionAcceptanceConfig();

        expect(config.enabled).toBe(false);

        if (!config.enabled) {
          expect(config.metadata.frontendOrigin).toBe('[missing]');
          expect(config.metadata.backendOrigin).toBe('[missing]');
          expect(config.metadata.missingEnv).toEqual(smokeEnvKeys);
          expect(config.blockedReason).toContain('CHATIFY_PRODUCTION_SMOKE=1');
          expect(config.blockedReason).toContain('CHATIFY_PROD_FRONTEND_URL');
        }
      }
    );
  });

  test('rejects local origins for Phase 14 production acceptance', async () => {
    await withSmokeEnv(
      {
        ...validSmokeEnv,
        CHATIFY_PROD_FRONTEND_URL: 'http://localhost:5173',
        CHATIFY_PROD_BACKEND_URL: 'http://127.0.0.1:5000',
      },
      () => {
        const config = getPhase14ProductionAcceptanceConfig();

        expect(config.enabled).toBe(false);

        if (!config.enabled) {
          expect(config.metadata.invalidUrlEnv).toEqual([
            'CHATIFY_PROD_FRONTEND_URL',
            'CHATIFY_PROD_BACKEND_URL',
          ]);
        }
      }
    );
  });

  test('creates a sanitized blocked setup artifact without overwriting the live report', async ({ browserName }, testInfo) => {
    void browserName;

    await withSmokeEnv(missingSmokeEnv, () => {
      const canonicalPath = getPhase14LiveAcceptancePath();
      const canonicalBefore = fs.existsSync(canonicalPath)
        ? fs.readFileSync(canonicalPath, 'utf8')
        : null;
      const reportPath = testInfo.outputPath('phase14-blocked-setup.md');

      writePhase14BlockedSetupReport(
        'npm run test:e2e:prod -- --grep "production smoke config"',
        '2026-06-13T00:00:00.000Z',
        reportPath
      );

      const report = fs.readFileSync(reportPath, 'utf8');
      const canonicalAfter = fs.existsSync(canonicalPath)
        ? fs.readFileSync(canonicalPath, 'utf8')
        : null;

      expect(canonicalPath).toContain('14-LIVE-ACCEPTANCE.md');
      expect(canonicalAfter).toBe(canonicalBefore);
      expect(reportPath).toContain('phase14-blocked-setup.md');
      expect(report).toContain('Frontend origin | [missing]');
      expect(report).toContain('Missing env | CHATIFY_PRODUCTION_SMOKE');
      expect(report).not.toContain('example-secret');
      expect(report).not.toContain('sender@example.test');
    });
  });

  test('matches WebSocket transport URLs to the configured backend origin', () => {
    expect(phase14UrlMatchesBackendOrigin(
      'wss://chatify-ckmn.onrender.com/socket.io/?EIO=4&transport=websocket',
      'https://chatify-ckmn.onrender.com'
    )).toBe(true);
    expect(phase14UrlMatchesBackendOrigin(
      'ws://127.0.0.1:5000/socket.io/?EIO=4&transport=websocket',
      'http://127.0.0.1:5000'
    )).toBe(true);
    expect(phase14UrlMatchesBackendOrigin(
      'wss://other.example.com/socket.io/?EIO=4&transport=websocket',
      'https://chatify-ckmn.onrender.com'
    )).toBe(false);
  });

  test('matches production traffic through either backend or same-origin proxy', () => {
    expect(phase14UrlMatchesAcceptedOrigin(
      'https://chatify-ten-rho.vercel.app/api/auth/check',
      ['https://chatify-ckmn.onrender.com', 'https://chatify-ten-rho.vercel.app']
    )).toBe(true);
    expect(phase14UrlMatchesAcceptedOrigin(
      'wss://chatify-ten-rho.vercel.app/socket.io/?EIO=4&transport=websocket',
      ['https://chatify-ckmn.onrender.com', 'https://chatify-ten-rho.vercel.app']
    )).toBe(true);
    expect(phase14UrlMatchesAcceptedOrigin(
      'https://unexpected.example.com/api/auth/check',
      ['https://chatify-ckmn.onrender.com', 'https://chatify-ten-rho.vercel.app']
    )).toBe(false);
  });

  test('finds static content leaks while allowing current-run markers', () => {
    expect(findPhase14StaticContentLeaks('message-states-spec.pdf')).toEqual(['message-states-spec.pdf']);
    expect(findPhase14StaticContentLeaks('message-states-spec.pdf', ['message-states-spec.pdf'])).toEqual([]);
  });
});
