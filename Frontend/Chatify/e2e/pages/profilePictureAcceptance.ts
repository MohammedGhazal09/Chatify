import fs from 'node:fs';
import path from 'node:path';

const phase16AcceptancePath = path.resolve(
  process.cwd(),
  '../../.planning/phases/16-profile-picture-upload-and-shared-avatar-visibility/16-PROFILE-IMAGE-ACCEPTANCE.md'
);

export const phase16RequiredEnvVars = [
  'CHATIFY_LOCAL_PROFILE_IMAGE_ACCEPTANCE',
  'CHATIFY_LOCAL_BACKEND_URL',
  'VITE_BACKEND_URL',
  'CHATIFY_LOCAL_USER_A_EMAIL',
  'CHATIFY_LOCAL_USER_A_PASSWORD',
  'CHATIFY_LOCAL_USER_B_EMAIL',
  'CHATIFY_LOCAL_USER_B_PASSWORD',
] as const;

type Phase16RequiredEnvVar = typeof phase16RequiredEnvVars[number];

export interface Phase16LocalAccount {
  label: 'Account A' | 'Account B';
  email: string;
  password: string;
  redactedEmail: string;
}

export type Phase16AcceptanceConfig =
  | {
    enabled: true;
    backendUrl: string;
    accounts: {
      uploader: Phase16LocalAccount;
      observer: Phase16LocalAccount;
    };
    metadata: Phase16AcceptanceMetadata;
  }
  | {
    enabled: false;
    blockedReason: string;
    blockers: string[];
    metadata: Phase16AcceptanceMetadata;
  };

interface Phase16AcceptanceMetadata {
  optIn: boolean;
  frontendOrigin: string;
  backendOrigin: string;
  missingEnv: Phase16RequiredEnvVar[];
  invalidEnv: string[];
  accounts: Array<{
    label: Phase16LocalAccount['label'];
    redactedEmail: string;
  }>;
}

export interface Phase16AcceptanceReportInput {
  config: Phase16AcceptanceConfig;
  command: string;
  status: 'passed' | 'blocked' | 'failed';
  checks?: Array<{
    name: string;
    status: 'passed' | 'blocked' | 'failed' | 'skipped';
    detail: string;
  }>;
  blockers?: string[];
  risks?: string[];
  generatedAt?: string;
  outputPath?: string;
}

const generatedProfileImageDir = path.resolve(process.cwd(), 'test-results/phase16-generated-profile-images');

const generatedPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8DwnwEJMDGgAcICAD+fA/8GNz2mAAAAAElFTkSuQmCC',
  'base64'
);

const readEnv = (name: Phase16RequiredEnvVar) => process.env[name]?.trim() ?? '';

const redactEmail = (email: string) => {
  const [local = '', domain = ''] = email.split('@');
  const localPrefix = local.slice(0, 2) || '**';
  const domainParts = domain.split('.');
  const domainSuffix = domainParts.length > 1 ? domainParts.at(-1) : '';

  return `${localPrefix}***@***${domainSuffix ? `.${domainSuffix}` : ''}`;
};

const parseLocalUrl = (value: string, name: string) => {
  if (!value) {
    return {
      invalid: '',
      origin: '[missing]',
      url: '',
    };
  }

  try {
    const parsed = new URL(value);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`${name} must use http or https.`);
    }

    parsed.hash = '';

    return {
      invalid: '',
      origin: parsed.origin,
      url: parsed.toString().replace(/\/$/, ''),
    };
  } catch {
    return {
      invalid: name,
      origin: '[invalid]',
      url: '',
    };
  }
};

const isLoopbackHost = (urlValue: string) => {
  try {
    const hostname = new URL(urlValue).hostname.toLowerCase();

    return hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.localhost');
  } catch {
    return false;
  }
};

const buildAccount = (
  slot: 'A' | 'B',
  label: Phase16LocalAccount['label']
): Phase16LocalAccount | null => {
  const email = readEnv(`CHATIFY_LOCAL_USER_${slot}_EMAIL` as Phase16RequiredEnvVar);
  const password = readEnv(`CHATIFY_LOCAL_USER_${slot}_PASSWORD` as Phase16RequiredEnvVar);

  if (!email || !password) {
    return null;
  }

  return {
    label,
    email,
    password,
    redactedEmail: redactEmail(email),
  };
};

export const getPhase16AcceptancePath = () => phase16AcceptancePath;

export const getPhase16AcceptanceConfig = (): Phase16AcceptanceConfig => {
  const missingEnv = phase16RequiredEnvVars.filter((name) => !readEnv(name));
  const optIn = readEnv('CHATIFY_LOCAL_PROFILE_IMAGE_ACCEPTANCE') === '1';
  const backend = parseLocalUrl(readEnv('CHATIFY_LOCAL_BACKEND_URL'), 'CHATIFY_LOCAL_BACKEND_URL');
  const viteBackend = parseLocalUrl(readEnv('VITE_BACKEND_URL'), 'VITE_BACKEND_URL');
  const invalidEnv = [backend.invalid, viteBackend.invalid].filter(Boolean);
  const allowNonlocal = process.env.CHATIFY_ALLOW_NONLOCAL_PROFILE_IMAGE_ACCEPTANCE === '1';
  const uploader = buildAccount('A', 'Account A');
  const observer = buildAccount('B', 'Account B');

  if (backend.url && viteBackend.url && backend.url !== viteBackend.url) {
    invalidEnv.push('VITE_BACKEND_URL must match CHATIFY_LOCAL_BACKEND_URL for Phase 16 local acceptance.');
  }

  if (backend.url && !isLoopbackHost(backend.url) && !allowNonlocal) {
    invalidEnv.push('CHATIFY_LOCAL_BACKEND_URL must be loopback unless CHATIFY_ALLOW_NONLOCAL_PROFILE_IMAGE_ACCEPTANCE=1 is set.');
  }

  const metadata: Phase16AcceptanceMetadata = {
    optIn,
    frontendOrigin: 'http://127.0.0.1:4177',
    backendOrigin: backend.origin,
    missingEnv,
    invalidEnv,
    accounts: [
      { label: 'Account A', redactedEmail: uploader?.redactedEmail ?? '[missing]' },
      { label: 'Account B', redactedEmail: observer?.redactedEmail ?? '[missing]' },
    ],
  };
  const blockers: string[] = [];

  if (!optIn) {
    blockers.push('CHATIFY_LOCAL_PROFILE_IMAGE_ACCEPTANCE=1 is required for Phase 16 local profile-picture acceptance.');
  }

  if (missingEnv.length > 0) {
    blockers.push(`Missing Phase 16 local acceptance environment: ${missingEnv.join(', ')}.`);
  }

  if (invalidEnv.length > 0) {
    blockers.push(`Invalid Phase 16 local acceptance environment: ${invalidEnv.join(', ')}.`);
  }

  if (!uploader || !observer) {
    blockers.push('Two existing local accounts are required; generated accounts are not used for profile-image acceptance.');
  }

  if (blockers.length > 0 || !uploader || !observer) {
    return {
      enabled: false,
      blockedReason: blockers.join(' '),
      blockers,
      metadata,
    };
  }

  return {
    enabled: true,
    backendUrl: backend.url,
    accounts: {
      uploader,
      observer,
    },
    metadata,
  };
};

export const ensurePhase16ProfileImageFixture = () => {
  fs.mkdirSync(generatedProfileImageDir, { recursive: true });
  const filePath = path.join(generatedProfileImageDir, 'phase16-avatar-a.png');
  fs.writeFileSync(filePath, generatedPng);
  return filePath;
};

const formatList = (items: readonly string[]) => (items.length > 0 ? items.join(', ') : 'None');

const sanitize = (value: string) => {
  const sensitiveValues = phase16RequiredEnvVars
    .map((name) => process.env[name]?.trim())
    .filter((secret): secret is string => Boolean(secret && secret !== '1' && !secret.startsWith('http')));
  let output = value;

  sensitiveValues.forEach((secret, index) => {
    output = output.split(secret).join(`[redacted-${index + 1}]`);
  });

  return output.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (email) => redactEmail(email));
};

export const writePhase16AcceptanceReport = ({
  blockers = [],
  checks = [],
  command,
  config,
  generatedAt = new Date().toISOString(),
  outputPath = phase16AcceptancePath,
  risks = [],
  status,
}: Phase16AcceptanceReportInput) => {
  const allBlockers = config.enabled ? blockers : [...config.blockers, ...blockers];
  const rows = checks.length > 0
    ? checks.map((check) => `| ${check.name} | ${check.status} | ${check.detail} |`)
    : ['| Local two-account flow | blocked | Acceptance flow has not run. |'];
  const accountSummary = config.metadata.accounts
    .map((account) => `${account.label} (${account.redactedEmail})`)
    .join(', ');
  const content = `
# Phase 16 Profile Image Acceptance

**Generated:** ${generatedAt}
**Status:** ${status}
**Command:** ${command}
**Scope:** Local acceptance only; this is not production readiness evidence.

## Local Target

| Field | Value |
|-------|-------|
| Frontend origin | ${config.metadata.frontendOrigin} |
| Backend origin | ${config.metadata.backendOrigin} |
| Opted in | ${config.metadata.optIn ? 'yes' : 'no'} |
| Accounts | ${accountSummary} |
| Missing env | ${formatList(config.metadata.missingEnv)} |
| Invalid env | ${formatList(config.metadata.invalidEnv)} |

## Check Results

| Check | Status | Detail |
|-------|--------|--------|
${rows.join('\n')}

## Blockers

${allBlockers.length > 0 ? allBlockers.map((blocker) => `- ${blocker}`).join('\n') : '- None'}

## Remaining Risks

${risks.length > 0 ? risks.map((risk) => `- ${risk}`).join('\n') : '- None'}
`;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${sanitize(content.trim())}\n`, 'utf8');
};
