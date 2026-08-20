import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext } from '@playwright/test';
import { getPhase14ProductionAcceptanceConfig } from './phase14ProductionAcceptance';
import { redactEmail } from './productionSmoke';

const phase15CallAcceptancePath = path.resolve(
  process.cwd(),
  '../../.planning/phases/15-investigate-and-fix-audio-and-video-call-reliability/15-CALL-ACCEPTANCE.md'
);

export const phase15LocalRequiredEnvVars = [
  'CHATIFY_LOCAL_CALL_SMOKE',
  'CHATIFY_LOCAL_FRONTEND_URL',
  'CHATIFY_LOCAL_BACKEND_URL',
  'CHATIFY_LOCAL_USER_A_EMAIL',
  'CHATIFY_LOCAL_USER_A_PASSWORD',
  'CHATIFY_LOCAL_USER_B_EMAIL',
  'CHATIFY_LOCAL_USER_B_PASSWORD',
] as const;

const phase15SecretEnvVars = [
  'CHATIFY_LOCAL_USER_A_EMAIL',
  'CHATIFY_LOCAL_USER_A_PASSWORD',
  'CHATIFY_LOCAL_USER_B_EMAIL',
  'CHATIFY_LOCAL_USER_B_PASSWORD',
  'CHATIFY_SMOKE_USER_A_EMAIL',
  'CHATIFY_SMOKE_USER_A_PASSWORD',
  'CHATIFY_SMOKE_USER_B_EMAIL',
  'CHATIFY_SMOKE_USER_B_PASSWORD',
] as const;

type Phase15LocalRequiredEnvVar = typeof phase15LocalRequiredEnvVars[number];
type Phase15LocalUrlEnvVar = 'CHATIFY_LOCAL_FRONTEND_URL' | 'CHATIFY_LOCAL_BACKEND_URL';

interface Phase15LocalAccount {
  label: 'Local smoke user A' | 'Local smoke user B';
  email: string;
  password: string;
  redactedEmail: string;
}

interface Phase15LocalAccountSummary {
  label: Phase15LocalAccount['label'];
  redactedEmail: string;
}

interface Phase15LocalMetadata {
  frontendOrigin: string;
  backendOrigin: string;
  accounts: Phase15LocalAccountSummary[];
  missingEnv: Phase15LocalRequiredEnvVar[];
  invalidUrlEnv: Phase15LocalUrlEnvVar[];
  optIn: boolean;
}

export type Phase15LocalCallConfig =
  | {
    enabled: true;
    frontendUrl: string;
    backendUrl: string;
    accounts: {
      sender: Phase15LocalAccount;
      recipient: Phase15LocalAccount;
    };
    metadata: Phase15LocalMetadata;
  }
  | {
    enabled: false;
    blockedReason: string;
    blockers: string[];
    metadata: Phase15LocalMetadata;
  };

type Phase15CheckStatus = 'passed' | 'failed' | 'blocked' | 'skipped';

export interface Phase15CheckRow {
  name: string;
  status: Phase15CheckStatus;
  detail?: string;
}

interface Phase15CallAcceptanceReportInput {
  blockers?: string[];
  checks?: Phase15CheckRow[];
  command: string;
  config: Phase15LocalCallConfig;
  evidencePaths?: string[];
  generatedAt?: string;
  risks?: string[];
  status: 'local_ready' | 'local_blocked' | 'production_blocked' | 'production_ready' | 'failed';
}

interface Phase15ApiAuth {
  cookieHeader: string;
  csrfToken: string;
}

type BrowserCookie = Parameters<BrowserContext['addCookies']>[0][number];

const csrfCookieName = 'XSRF-TOKEN';
const csrfHeaderName = 'X-CSRF-Token';

const readEnv = (name: Phase15LocalRequiredEnvVar) => process.env[name]?.trim() ?? '';

const formatList = (items: readonly string[]) => {
  if (items.length === 0) {
    return 'None';
  }

  return items.join(', ');
};

const parseRequiredLocalUrl = (name: Phase15LocalUrlEnvVar) => {
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

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Phase 15 local URL must use http or https.');
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
}: Pick<Phase15LocalMetadata, 'invalidUrlEnv' | 'missingEnv' | 'optIn'>) => {
  const reasons: string[] = [];

  if (!optIn) {
    reasons.push('CHATIFY_LOCAL_CALL_SMOKE=1 is required for Phase 15 local two-account call acceptance.');
  }

  if (missingEnv.length > 0) {
    reasons.push(`Missing Phase 15 local call environment: ${missingEnv.join(', ')}.`);
  }

  if (invalidUrlEnv.length > 0) {
    reasons.push(`Invalid Phase 15 local URL environment: ${invalidUrlEnv.join(', ')}.`);
  }

  return reasons;
};

export const getPhase15LocalCallConfig = (): Phase15LocalCallConfig => {
  const missingEnv = phase15LocalRequiredEnvVars.filter((name) => !readEnv(name));
  const optIn = readEnv('CHATIFY_LOCAL_CALL_SMOKE') === '1';
  const frontendUrl = parseRequiredLocalUrl('CHATIFY_LOCAL_FRONTEND_URL');
  const backendUrl = parseRequiredLocalUrl('CHATIFY_LOCAL_BACKEND_URL');
  const invalidUrlEnv = [frontendUrl.invalidEnv, backendUrl.invalidEnv].filter(
    (name): name is Phase15LocalUrlEnvVar => Boolean(name)
  );
  const senderEmail = readEnv('CHATIFY_LOCAL_USER_A_EMAIL');
  const recipientEmail = readEnv('CHATIFY_LOCAL_USER_B_EMAIL');
  const metadata: Phase15LocalMetadata = {
    frontendOrigin: frontendUrl.origin,
    backendOrigin: backendUrl.origin,
    accounts: [
      { label: 'Local smoke user A', redactedEmail: senderEmail ? redactEmail(senderEmail) : '[missing]' },
      { label: 'Local smoke user B', redactedEmail: recipientEmail ? redactEmail(recipientEmail) : '[missing]' },
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
        label: 'Local smoke user A',
        email: senderEmail,
        password: readEnv('CHATIFY_LOCAL_USER_A_PASSWORD'),
        redactedEmail: redactEmail(senderEmail),
      },
      recipient: {
        label: 'Local smoke user B',
        email: recipientEmail,
        password: readEnv('CHATIFY_LOCAL_USER_B_PASSWORD'),
        redactedEmail: redactEmail(recipientEmail),
      },
    },
    metadata,
  };
};

const splitSetCookieHeaders = (header: string) => (header ? [header] : []);

const getSetCookieHeaders = (response: Response) => {
  const headersWithGetSetCookie = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookieHeaders = headersWithGetSetCookie.getSetCookie?.();

  if (setCookieHeaders?.length) {
    return setCookieHeaders;
  }

  return splitSetCookieHeaders(response.headers.get('set-cookie') ?? '');
};

const getCookieNameValue = (header: string) => {
  const [nameValue] = header.split(';').map((part) => part.trim());
  const separatorIndex = nameValue.indexOf('=');

  if (separatorIndex <= 0) {
    return null;
  }

  return {
    name: nameValue.slice(0, separatorIndex),
    value: decodeURIComponent(nameValue.slice(separatorIndex + 1)),
  };
};

const parseSetCookieHeader = (header: string, backendUrl: string): BrowserCookie | null => {
  const [nameValue, ...attributes] = header.split(';').map((part) => part.trim());
  const separatorIndex = nameValue.indexOf('=');

  if (separatorIndex <= 0) {
    return null;
  }

  const cookie: BrowserCookie = {
    name: nameValue.slice(0, separatorIndex),
    value: nameValue.slice(separatorIndex + 1),
    url: backendUrl,
  };

  attributes.forEach((attribute) => {
    const [rawName, ...rawValue] = attribute.split('=');
    const name = rawName.toLowerCase();
    const value = rawValue.join('=');

    if (name === 'path' && value) {
      cookie.path = value;
    } else if (name === 'httponly') {
      cookie.httpOnly = true;
    } else if (name === 'secure') {
      cookie.secure = true;
    } else if (name === 'samesite') {
      const normalized = value.toLowerCase();

      if (normalized === 'strict' || normalized === 'lax' || normalized === 'none') {
        cookie.sameSite = `${normalized[0].toUpperCase()}${normalized.slice(1)}` as BrowserCookie['sameSite'];
      }
    }
  });

  return cookie;
};

const getCsrfTokenForApiAuth = async (backendUrl: string) => {
  const response = await fetch(`${backendUrl}/api/csrf-token`);

  if (!response.ok) {
    throw new Error(`Phase 15 local CSRF bootstrap failed with HTTP ${response.status}.`);
  }

  const setCookieHeaders = getSetCookieHeaders(response);
  const csrfCookieHeader = setCookieHeaders.find((header) => (
    getCookieNameValue(header)?.name === csrfCookieName
  ));
  const csrfCookie = csrfCookieHeader ? getCookieNameValue(csrfCookieHeader) : null;

  if (!csrfCookieHeader || !csrfCookie) {
    throw new Error('Phase 15 local CSRF bootstrap did not return an XSRF-TOKEN cookie.');
  }

  return {
    cookieHeader: `${csrfCookieName}=${encodeURIComponent(csrfCookie.value)}`,
    setCookieHeaders,
    token: csrfCookie.value,
  };
};

export const authenticatePhase15LocalContext = async ({
  account,
  backendUrl,
  context,
}: {
  account: Phase15LocalAccount;
  backendUrl: string;
  context: BrowserContext;
}): Promise<Phase15ApiAuth> => {
  const csrf = await getCsrfTokenForApiAuth(backendUrl);
  const response = await fetch(`${backendUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [csrfHeaderName]: csrf.token,
      cookie: csrf.cookieHeader,
    },
    body: JSON.stringify({
      email: account.email,
      password: account.password,
      rememberMe: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`${account.label} API login failed with HTTP ${response.status}.`);
  }

  const cookies = [...csrf.setCookieHeaders, ...getSetCookieHeaders(response)]
    .map((header) => parseSetCookieHeader(header, backendUrl))
    .filter((cookie): cookie is BrowserCookie => Boolean(cookie));

  if (cookies.length === 0) {
    throw new Error(`${account.label} API login did not return auth cookies.`);
  }

  await context.addCookies(cookies);

  return {
    cookieHeader: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '),
    csrfToken: csrf.token,
  };
};

export const createPhase15LocalDirectChat = async ({
  auth,
  backendUrl,
  targetEmail,
}: {
  auth: Phase15ApiAuth;
  backendUrl: string;
  targetEmail: string;
}) => {
  const response = await fetch(`${backendUrl}/api/chat/create-new-chat`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [csrfHeaderName]: auth.csrfToken,
      cookie: auth.cookieHeader,
    },
    body: JSON.stringify({ targetEmail }),
  });

  if (!response.ok) {
    throw new Error(`Phase 15 local direct chat setup failed with HTTP ${response.status}.`);
  }

  const payload = await response.json() as {
    data?: {
      chat?: {
        _id?: string;
      };
    };
  };
  const chatId = payload.data?.chat?._id;

  if (!chatId) {
    throw new Error('Phase 15 local direct chat setup did not return a chat id.');
  }

  return chatId;
};

export const sanitizePhase15ArtifactText = (value: string) => {
  const sensitiveValues = phase15SecretEnvVars
    .map((name) => process.env[name]?.trim())
    .filter((secret): secret is string => Boolean(secret && secret !== '1'));
  let sanitized = value;

  sensitiveValues.forEach((secret, index) => {
    sanitized = sanitized.split(secret).join(`[redacted-${index + 1}]`);
  });

  return sanitized.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (email) => redactEmail(email));
};

export const getPhase15CallAcceptancePath = () => phase15CallAcceptancePath;

export const writePhase15CallAcceptanceReport = ({
  blockers = [],
  checks = [],
  command,
  config,
  evidencePaths = [],
  generatedAt = new Date().toISOString(),
  risks = [],
  status,
}: Phase15CallAcceptanceReportInput) => {
  const productionConfig = getPhase14ProductionAcceptanceConfig();
  const productionBlockers = productionConfig.enabled ? [] : productionConfig.blockers;
  const allBlockers = [
    ...(config.enabled ? [] : config.blockers),
    ...productionBlockers,
    ...blockers,
  ];
  const effectiveStatus = status === 'failed'
    ? 'failed'
    : allBlockers.length > 0
      ? 'production_blocked'
      : status;
  const productionCheck: Phase15CheckRow = {
    name: 'Phase 15 production smoke environment contract',
    status: productionConfig.enabled ? 'passed' : 'blocked',
    detail: productionConfig.enabled
      ? 'Phase 14 production smoke environment is configured; TURN readiness must still be proven by the live call run.'
      : productionConfig.blockedReason,
  };
  const reportChecks = [...checks, productionCheck];
  const rows = reportChecks.length > 0
    ? reportChecks.map((check) => `| ${check.name} | ${check.status} | ${check.detail ?? ''} |`)
    : ['| Phase 15 local harness | blocked | Full local workflow has not run yet. |'];
  const accountSummary = config.metadata.accounts
    .map((account) => `${account.label} (${account.redactedEmail})`)
    .join(', ');
  const recommendation = effectiveStatus === 'local_ready' || effectiveStatus === 'production_ready'
    ? 'Recommendation: treat the matching readiness layer as accepted and keep any remaining layer-specific blockers explicit.'
    : 'Recommendation: keep Phase 15 readiness blocked until the listed prerequisites pass with zero call blockers.';
  const content = `
# Phase 15 Call Acceptance

**Generated:** ${generatedAt}
**Status:** ${effectiveStatus}
**Command:** ${command}

## Local Target

| Field | Value |
|-------|-------|
| Frontend origin | ${config.metadata.frontendOrigin} |
| Backend origin | ${config.metadata.backendOrigin} |
| Opted in | ${config.metadata.optIn ? 'yes' : 'no'} |
| Accounts | ${accountSummary} |
| Missing env | ${formatList(config.metadata.missingEnv)} |
| Invalid URL env | ${formatList(config.metadata.invalidUrlEnv)} |

## Production Target

| Field | Value |
|-------|-------|
| Frontend origin | ${productionConfig.metadata.frontendOrigin} |
| Backend origin | ${productionConfig.metadata.backendOrigin} |
| Opted in | ${productionConfig.metadata.optIn ? 'yes' : 'no'} |
| Missing env | ${formatList(productionConfig.metadata.missingEnv)} |
| Invalid URL env | ${formatList(productionConfig.metadata.invalidUrlEnv)} |

## Check Results

| Check | Status | Detail |
|-------|--------|--------|
${rows.join('\n')}

## Blockers

${allBlockers.length > 0 ? allBlockers.map((blocker) => `- ${blocker}`).join('\n') : '- None'}

## Evidence Paths

${evidencePaths.length > 0 ? evidencePaths.map((evidencePath) => `- ${evidencePath}`).join('\n') : '- None yet'}

## Remaining Risks

${risks.length > 0 ? risks.map((risk) => `- ${risk}`).join('\n') : '- Production call readiness still requires configured production smoke and TURN evidence.'}

## Final Recommendation

${recommendation}
`;

  fs.mkdirSync(path.dirname(phase15CallAcceptancePath), { recursive: true });
  fs.writeFileSync(phase15CallAcceptancePath, `${sanitizePhase15ArtifactText(content.trim())}\n`, 'utf8');
};

export const writePhase15BlockedLocalSetupReport = (command: string, generatedAt?: string) => {
  const config = getPhase15LocalCallConfig();

  writePhase15CallAcceptanceReport({
    command,
    config,
    generatedAt,
    status: config.enabled ? 'local_ready' : 'local_blocked',
    checks: [
      {
        name: 'Phase 15 local two-account environment contract',
        status: config.enabled ? 'passed' : 'blocked',
        detail: config.enabled ? 'Required local call smoke environment is configured.' : config.blockedReason,
      },
    ],
    risks: [
      'Local audio/video readiness cannot be accepted until the full two-account fake-media workflow passes.',
      'Production readiness remains separate and requires production smoke plus TURN evidence.',
    ],
  });
};
