import { expect, test } from '@playwright/test';
import { getProductionSmokeConfig } from './pages/productionSmoke';

const smokeEnvKeys = [
  'CHATIFY_PRODUCTION_SMOKE',
  'CHATIFY_PROD_FRONTEND_URL',
  'CHATIFY_PROD_BACKEND_URL',
  'CHATIFY_SMOKE_USER_A_EMAIL',
  'CHATIFY_SMOKE_USER_A_PASSWORD',
  'CHATIFY_SMOKE_USER_B_EMAIL',
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
  CHATIFY_SMOKE_USER_A_PASSWORD: 'example-secret-a',
  CHATIFY_SMOKE_USER_B_EMAIL: 'recipient@example.test',
  CHATIFY_SMOKE_USER_B_PASSWORD: 'example-secret-b',
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
