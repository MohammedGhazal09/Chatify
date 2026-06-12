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

const normalizeUrl = (value: string, fallback: string) => {
  try {
    const parsed = new URL(value || fallback);
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
};

export const getProductionSmokeConfig = (): ProductionSmokeConfig => {
  const missingEnv = requiredEnvVars.filter((name) => !readEnv(name));
  const optIn = readEnv('CHATIFY_PRODUCTION_SMOKE') === '1';
  const frontendUrl = normalizeUrl(readEnv('CHATIFY_PROD_FRONTEND_URL'), 'https://chatify-ten-rho.vercel.app');
  const backendUrl = normalizeUrl(readEnv('CHATIFY_PROD_BACKEND_URL'), 'https://chatify-ckmn.onrender.com');
  const senderEmail = readEnv('CHATIFY_SMOKE_USER_A_EMAIL');
  const recipientEmail = readEnv('CHATIFY_SMOKE_USER_B_EMAIL');
  const metadata: ProductionSmokeMetadata = {
    frontendOrigin: new URL(frontendUrl).origin,
    backendOrigin: new URL(backendUrl).origin,
    accounts: [
      { label: 'Smoke user A', redactedEmail: senderEmail ? redactEmail(senderEmail) : '[missing]' },
      { label: 'Smoke user B', redactedEmail: recipientEmail ? redactEmail(recipientEmail) : '[missing]' },
    ],
    missingEnv,
    optIn,
  };

  if (!optIn || missingEnv.length > 0) {
    const reason = !optIn
      ? 'CHATIFY_PRODUCTION_SMOKE=1 is required for live production smoke.'
      : `Missing production smoke environment: ${missingEnv.join(', ')}.`;

    return {
      enabled: false,
      blockedReason: reason,
      metadata,
    };
  }

  return {
    enabled: true,
    frontendUrl,
    backendUrl,
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
