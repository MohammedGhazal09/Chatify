import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { redactEmail, type ProductionSmokeAccount } from './productionSmoke';

const phase14LiveAcceptancePath = path.resolve(
  process.cwd(),
  '../../.planning/phases/14-production-live-acceptance-gate/14-LIVE-ACCEPTANCE.md'
);

export const phase14RequiredEnvVars = [
  'CHATIFY_PRODUCTION_SMOKE',
  'CHATIFY_PROD_FRONTEND_URL',
  'CHATIFY_PROD_BACKEND_URL',
  'CHATIFY_SMOKE_USER_A_EMAIL',
  'CHATIFY_SMOKE_USER_A_PASSWORD',
  'CHATIFY_SMOKE_USER_B_EMAIL',
  'CHATIFY_SMOKE_USER_B_PASSWORD',
] as const;

const phase14SecretEnvVars = [
  'CHATIFY_SMOKE_USER_A_EMAIL',
  'CHATIFY_SMOKE_USER_A_PASSWORD',
  'CHATIFY_SMOKE_USER_B_EMAIL',
  'CHATIFY_SMOKE_USER_B_PASSWORD',
] as const;

type Phase14RequiredEnvVar = typeof phase14RequiredEnvVars[number];
type Phase14UrlEnvVar = 'CHATIFY_PROD_FRONTEND_URL' | 'CHATIFY_PROD_BACKEND_URL';

interface Phase14AccountLabel {
  label: ProductionSmokeAccount['label'];
  redactedEmail: string;
}

export interface Phase14ProductionMetadata {
  frontendOrigin: string;
  backendOrigin: string;
  deployedFrontendCommit: string;
  deployedBackendCommit: string;
  accounts: Phase14AccountLabel[];
  missingEnv: Phase14RequiredEnvVar[];
  invalidUrlEnv: Phase14UrlEnvVar[];
  optIn: boolean;
}

export type Phase14ProductionAcceptanceConfig =
  | {
    enabled: true;
    frontendUrl: string;
    backendUrl: string;
    accounts: {
      sender: ProductionSmokeAccount;
      recipient: ProductionSmokeAccount;
    };
    metadata: Phase14ProductionMetadata;
  }
  | {
    enabled: false;
    blockedReason: string;
    blockers: string[];
    metadata: Phase14ProductionMetadata;
  };

export type Phase14CheckStatus = 'passed' | 'failed' | 'blocked' | 'skipped';

export interface Phase14CheckRow {
  name: string;
  status: Phase14CheckStatus;
  detail?: string;
}

export interface Phase14LiveAcceptanceReportInput {
  config: Phase14ProductionAcceptanceConfig;
  status: Phase14CheckStatus;
  command: string;
  checks?: Phase14CheckRow[];
  blockers?: string[];
  evidencePaths?: string[];
  outputPath?: string;
  risks?: string[];
  generatedAt?: string;
  gitHead?: string;
}

export const phase14StaticContentDenylist = [
  'IN-8B21',
  'message-states-spec.pdf',
  'delivery-metrics.xlsx',
  'retry-logic-notes.txt',
  'Chatify_Message_States_Spec.pdf',
  'Message_State_Diagram.vsdx',
  'Delivery_Matrix.xlsx',
  'Protocol Room',
  'Cipher Node',
  'phase6 visual fixture',
  'phase 6 visual fixture',
  'placeholder media',
  'fixture media',
] as const;

const readEnv = (name: Phase14RequiredEnvVar) => process.env[name]?.trim() ?? '';

const readOptionalCommitEnv = (name: 'CHATIFY_PROD_FRONTEND_COMMIT' | 'CHATIFY_PROD_BACKEND_COMMIT') => {
  const value = process.env[name]?.trim();

  if (!value) {
    return '[not provided]';
  }

  const sanitized = value.replace(/[^a-zA-Z0-9._/-]/g, '').slice(0, 80);
  return sanitized || '[invalid]';
};

const formatList = (items: readonly string[]) => {
  if (items.length === 0) {
    return 'None';
  }

  return items.join(', ');
};

const isLocalHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase();

  return normalized === 'localhost' ||
    normalized === '0.0.0.0' ||
    normalized === '[::1]' ||
    normalized === '::1' ||
    normalized.endsWith('.local') ||
    normalized.startsWith('127.');
};

const parseRequiredProductionUrl = (name: Phase14UrlEnvVar) => {
  const value = readEnv(name);

  if (!value) {
    return {
      invalidEnv: name,
      origin: '[missing]',
      url: '',
    };
  }

  try {
    const parsed = new URL(value);

    if (!['http:', 'https:'].includes(parsed.protocol) || isLocalHostname(parsed.hostname)) {
      throw new Error('Phase 14 production URL must be a deployed http(s) origin.');
    }

    parsed.hash = '';

    return {
      invalidEnv: null,
      origin: parsed.origin,
      url: parsed.toString().replace(/\/$/, ''),
    };
  } catch {
    return {
      invalidEnv: name,
      origin: '[invalid]',
      url: '',
    };
  }
};

const buildBlockedReason = ({
  invalidUrlEnv,
  missingEnv,
  optIn,
}: Pick<Phase14ProductionMetadata, 'invalidUrlEnv' | 'missingEnv' | 'optIn'>) => {
  const reasons: string[] = [];

  if (!optIn) {
    reasons.push('CHATIFY_PRODUCTION_SMOKE=1 is required for Phase 14 live acceptance.');
  }

  if (missingEnv.length > 0) {
    reasons.push(`Missing Phase 14 production acceptance environment: ${missingEnv.join(', ')}.`);
  }

  if (invalidUrlEnv.length > 0) {
    reasons.push(`Invalid Phase 14 production URL environment: ${invalidUrlEnv.join(', ')}.`);
  }

  return reasons;
};

export const getPhase14ProductionAcceptanceConfig = (): Phase14ProductionAcceptanceConfig => {
  const missingEnv = phase14RequiredEnvVars.filter((name) => !readEnv(name));
  const optIn = readEnv('CHATIFY_PRODUCTION_SMOKE') === '1';
  const frontendUrl = parseRequiredProductionUrl('CHATIFY_PROD_FRONTEND_URL');
  const backendUrl = parseRequiredProductionUrl('CHATIFY_PROD_BACKEND_URL');
  const invalidUrlEnv = [frontendUrl.invalidEnv, backendUrl.invalidEnv].filter((name): name is Phase14UrlEnvVar => Boolean(name));
  const senderEmail = readEnv('CHATIFY_SMOKE_USER_A_EMAIL');
  const recipientEmail = readEnv('CHATIFY_SMOKE_USER_B_EMAIL');
  const metadata: Phase14ProductionMetadata = {
    frontendOrigin: frontendUrl.origin,
    backendOrigin: backendUrl.origin,
    deployedFrontendCommit: readOptionalCommitEnv('CHATIFY_PROD_FRONTEND_COMMIT'),
    deployedBackendCommit: readOptionalCommitEnv('CHATIFY_PROD_BACKEND_COMMIT'),
    accounts: [
      { label: 'Smoke user A', redactedEmail: senderEmail ? redactEmail(senderEmail) : '[missing]' },
      { label: 'Smoke user B', redactedEmail: recipientEmail ? redactEmail(recipientEmail) : '[missing]' },
    ],
    invalidUrlEnv,
    missingEnv,
    optIn,
  };
  const blockers = buildBlockedReason(metadata);

  if (blockers.length > 0) {
    return {
      enabled: false,
      blockedReason: blockers.join(' '),
      blockers,
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

export const requirePhase14ProductionAcceptanceConfig = () => {
  const config = getPhase14ProductionAcceptanceConfig();

  if (!config.enabled) {
    throw new Error(config.blockedReason);
  }

  return config;
};

const getLocalGitHead = () => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: path.resolve(process.cwd(), '../..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '[unavailable]';
  }
};

export const sanitizePhase14ArtifactText = (value: string) => {
  const sensitiveValues = phase14SecretEnvVars
    .map((name) => process.env[name]?.trim())
    .filter((secret): secret is string => Boolean(secret && secret !== '1'));
  let sanitized = value;

  sensitiveValues.forEach((secret, index) => {
    sanitized = sanitized.split(secret).join(`[redacted-${index + 1}]`);
  });

  return sanitized.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (email) => redactEmail(email));
};

export const phase14UrlMatchesBackendOrigin = (urlValue: string, backendOrigin: string) => {
  try {
    const observed = new URL(urlValue);
    const expected = new URL(backendOrigin);
    const hostMatches = observed.hostname === expected.hostname && observed.port === expected.port;

    if (!hostMatches) {
      return false;
    }

    if (observed.protocol === expected.protocol) {
      return true;
    }

    return (expected.protocol === 'https:' && observed.protocol === 'wss:') ||
      (expected.protocol === 'http:' && observed.protocol === 'ws:');
  } catch {
    return false;
  }
};

export const phase14UrlMatchesAcceptedOrigin = (urlValue: string, origins: readonly string[]) => (
  origins.some((origin) => phase14UrlMatchesBackendOrigin(urlValue, origin))
);

export const findPhase14StaticContentLeaks = (text: string, allowlist: readonly string[] = []) => (
  phase14StaticContentDenylist.filter((entry) => text.includes(entry) && !allowlist.some((allowed) => allowed.includes(entry)))
);

export const getPhase14LiveAcceptancePath = () => phase14LiveAcceptancePath;

export const writePhase14LiveAcceptanceReport = ({
  blockers = [],
  checks = [],
  command,
  config,
  evidencePaths = [],
  outputPath = phase14LiveAcceptancePath,
  generatedAt = new Date().toISOString(),
  gitHead = getLocalGitHead(),
  risks = [],
  status,
}: Phase14LiveAcceptanceReportInput) => {
  const allBlockers = config.enabled ? blockers : [...config.blockers, ...blockers];
  const readiness = status === 'passed' && allBlockers.length === 0 ? 'Allowed' : 'Blocked';
  const finalDecision = readiness === 'Allowed'
    ? 'Readiness allowed: the Phase 14 live gate has zero blockers.'
    : `Readiness blocked: ${allBlockers.length} blocker${allBlockers.length === 1 ? '' : 's'} recorded.`;
  const rows = checks.length > 0
    ? checks.map((check) => `| ${check.name} | ${check.status} | ${check.detail ?? ''} |`)
    : ['| Harness initialized | blocked | Full live workflow has not run yet. |'];
  const accountSummary = config.metadata.accounts
    .map((account) => `${account.label} (${account.redactedEmail})`)
    .join(', ');
  const content = `
# Phase 14 Live Acceptance

**Generated:** ${generatedAt}
**Status:** ${status}
**Readiness:** ${readiness}
**Command:** ${command}
**Local git head:** ${gitHead}

## Production Target

| Field | Value |
|-------|-------|
| Frontend origin | ${config.metadata.frontendOrigin} |
| Backend origin | ${config.metadata.backendOrigin} |
| Frontend deployed commit | ${config.metadata.deployedFrontendCommit} |
| Backend deployed commit | ${config.metadata.deployedBackendCommit} |
| Opted in | ${config.metadata.optIn ? 'yes' : 'no'} |
| Accounts | ${accountSummary} |
| Missing env | ${formatList(config.metadata.missingEnv)} |
| Invalid URL env | ${formatList(config.metadata.invalidUrlEnv)} |

## Check Results

| Check | Status | Detail |
|-------|--------|--------|
${rows.join('\n')}

## Blockers

${allBlockers.length > 0 ? allBlockers.map((blocker) => `- ${blocker}`).join('\n') : '- None'}

## Evidence Paths

${evidencePaths.length > 0 ? evidencePaths.map((evidencePath) => `- ${evidencePath}`).join('\n') : '- None yet'}

## Remaining Risks

${risks.length > 0 ? risks.map((risk) => `- ${risk}`).join('\n') : '- Full live behavior acceptance has not run yet.'}

## Final Decision

${finalDecision}
`;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${sanitizePhase14ArtifactText(content.trim())}\n`, 'utf8');
};

export const writePhase14BlockedSetupReport = (command: string, generatedAt?: string, outputPath?: string) => {
  const config = getPhase14ProductionAcceptanceConfig();

  writePhase14LiveAcceptanceReport({
    command,
    config,
    generatedAt,
    outputPath,
    status: 'blocked',
    checks: [
      {
        name: 'Phase 14 production environment contract',
        status: config.enabled ? 'passed' : 'blocked',
        detail: config.enabled ? 'Required production smoke environment is configured.' : config.blockedReason,
      },
    ],
    risks: [
      'No live product readiness claim is allowed until the full Phase 14 gate passes with zero blockers.',
    ],
  });
};
