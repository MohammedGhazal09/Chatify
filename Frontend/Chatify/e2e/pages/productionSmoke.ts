import fs from 'node:fs';
import path from 'node:path';

const phaseAuditPath = path.resolve(
  process.cwd(),
  '../../.planning/phases/10-production-messenger-reality-audit-and-fixture-removal/10-PRODUCTION-AUDIT.md'
);

const requiredEnvVars = [
  'CHATIFY_PRODUCTION_SMOKE',
  'CHATIFY_PROD_FRONTEND_URL',
  'CHATIFY_PROD_BACKEND_URL',
  'CHATIFY_SMOKE_USER_A_EMAIL',
  'CHATIFY_SMOKE_USER_A_PASSWORD',
  'CHATIFY_SMOKE_USER_B_EMAIL',
  'CHATIFY_SMOKE_USER_B_PASSWORD',
] as const;

type RequiredEnvVar = typeof requiredEnvVars[number];
type UrlEnvVar = 'CHATIFY_PROD_FRONTEND_URL' | 'CHATIFY_PROD_BACKEND_URL';

const defaultFrontendUrl = 'https://chatify-ten-rho.vercel.app';
const defaultBackendUrl = 'https://chatify-ckmn.onrender.com';

export interface ProductionSmokeAccount {
  label: 'Smoke user A' | 'Smoke user B';
  email: string;
  password: string;
  redactedEmail: string;
}

export interface ProductionSmokeMetadata {
  frontendOrigin: string;
  backendOrigin: string;
  accounts: Array<Pick<ProductionSmokeAccount, 'label' | 'redactedEmail'>>;
  missingEnv: RequiredEnvVar[];
  invalidUrlEnv: UrlEnvVar[];
  optIn: boolean;
}

export type ProductionSmokeConfig =
  | {
    enabled: true;
    frontendUrl: string;
    backendUrl: string;
    accounts: {
      sender: ProductionSmokeAccount;
      recipient: ProductionSmokeAccount;
    };
    metadata: ProductionSmokeMetadata;
  }
  | {
    enabled: false;
    blockedReason: string;
    metadata: ProductionSmokeMetadata;
  };

const readEnv = (name: RequiredEnvVar) => process.env[name]?.trim() ?? '';

const redactEmail = (email: string) => {
  const [name = '', domain = ''] = email.split('@');
  const visiblePrefix = name.slice(0, 1) || '*';
  const [, ...domainTail] = domain.split('.');
  const redactedDomain = domainTail.length > 0 ? `***.${domainTail.join('.')}` : 'redacted';

  return `${visiblePrefix}***@${redactedDomain}`;
};

const parseSmokeUrl = (name: UrlEnvVar, fallback: string) => {
  const value = readEnv(name);

  try {
    const parsed = new URL(value || fallback);

    if (value && !['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Production smoke URL must use http or https.');
    }

    parsed.hash = '';
    const normalized = parsed.toString().replace(/\/$/, '');

    return {
      invalidEnv: null,
      origin: parsed.origin,
      url: normalized,
    };
  } catch {
    return {
      invalidEnv: name,
      origin: '[invalid]',
      url: fallback,
    };
  }
};

export const getProductionSmokeConfig = (): ProductionSmokeConfig => {
  const missingEnv = requiredEnvVars.filter((name) => !readEnv(name));
  const optIn = readEnv('CHATIFY_PRODUCTION_SMOKE') === '1';
  const frontendUrl = parseSmokeUrl('CHATIFY_PROD_FRONTEND_URL', defaultFrontendUrl);
  const backendUrl = parseSmokeUrl('CHATIFY_PROD_BACKEND_URL', defaultBackendUrl);
  const invalidUrlEnv = [frontendUrl.invalidEnv, backendUrl.invalidEnv].filter((name): name is UrlEnvVar => Boolean(name));
  const senderEmail = readEnv('CHATIFY_SMOKE_USER_A_EMAIL');
  const recipientEmail = readEnv('CHATIFY_SMOKE_USER_B_EMAIL');
  const metadata: ProductionSmokeMetadata = {
    frontendOrigin: frontendUrl.origin,
    backendOrigin: backendUrl.origin,
    accounts: [
      { label: 'Smoke user A', redactedEmail: senderEmail ? redactEmail(senderEmail) : '[missing]' },
      { label: 'Smoke user B', redactedEmail: recipientEmail ? redactEmail(recipientEmail) : '[missing]' },
    ],
    invalidUrlEnv,
    missingEnv,
    optIn,
  };

  if (!optIn || missingEnv.length > 0 || invalidUrlEnv.length > 0) {
    const reason = !optIn
      ? 'CHATIFY_PRODUCTION_SMOKE=1 is required for live production smoke.'
      : missingEnv.length > 0
        ? `Missing production smoke environment: ${missingEnv.join(', ')}.`
        : `Invalid production smoke URL environment: ${invalidUrlEnv.join(', ')}.`;

    return {
      enabled: false,
      blockedReason: reason,
      metadata,
    };
  }

  return {
    enabled: true,
    frontendUrl: frontendUrl.url,
    backendUrl: backendUrl.url,
    accounts: {
      sender: {
        label: 'Smoke user A',
        email: senderEmail,
        password: readEnv('CHATIFY_SMOKE_USER_A_PASSWORD'),
        redactedEmail: redactEmail(senderEmail),
      },
      recipient: {
        label: 'Smoke user B',
        email: recipientEmail,
        password: readEnv('CHATIFY_SMOKE_USER_B_PASSWORD'),
        redactedEmail: redactEmail(recipientEmail),
      },
    },
    metadata,
  };
};

export const requireProductionSmokeConfig = () => {
  const config = getProductionSmokeConfig();

  if (!config.enabled) {
    throw new Error(config.blockedReason);
  }

  return config;
};

export const getProductionSmokeAuditPath = () => phaseAuditPath;

export const makeSmokeMessageText = () => `phase10 production smoke ${new Date().toISOString()}`;

export const appendProductionSmokeAudit = (section: string) => {
  fs.mkdirSync(path.dirname(phaseAuditPath), { recursive: true });
  fs.appendFileSync(phaseAuditPath, `\n\n${section.trim()}\n`, 'utf8');
};
