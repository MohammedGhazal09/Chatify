import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext } from '@playwright/test';

const phaseAuditPath = path.resolve(
  process.cwd(),
  '../../.planning/phases/10-production-messenger-reality-audit-and-fixture-removal/10-PRODUCTION-AUDIT.md'
);
const phase101DeliveryReliabilityPath = path.resolve(
  process.cwd(),
  '../../.planning/phases/10.1-production-message-delivery-reliability-repair/10.1-DELIVERY-RELIABILITY.md'
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

const csrfCookieName = 'XSRF-TOKEN';
const csrfHeaderName = 'X-CSRF-Token';
const defaultFrontendUrl = 'https://chatify-ten-rho.vercel.app';
const defaultBackendUrl = 'https://chatify-ckmn.onrender.com';

export interface ProductionSmokeAccount {
  label: 'Smoke user A' | 'Smoke user B';
  email: string;
  password: string;
  redactedEmail: string;
}

type BrowserCookie = Parameters<BrowserContext['addCookies']>[0][number];

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

export const redactEmail = (email: string) => {
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

const splitSetCookieHeaders = (header: string) => {
  return header ? [header] : [];
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

const getCsrfTokenForApiAuth = async (backendUrl: string) => {
  const response = await fetch(`${backendUrl}/api/csrf-token`);

  if (!response.ok) {
    throw new Error(`Production smoke CSRF bootstrap failed with HTTP ${response.status}.`);
  }

  const setCookieHeaders = getSetCookieHeaders(response);
  const csrfCookieHeader = setCookieHeaders.find((header) => (
    getCookieNameValue(header)?.name === csrfCookieName
  ));
  const csrfCookie = csrfCookieHeader ? getCookieNameValue(csrfCookieHeader) : null;

  if (!csrfCookieHeader || !csrfCookie) {
    throw new Error('Production smoke CSRF bootstrap did not return an XSRF-TOKEN cookie.');
  }

  return {
    cookieHeader: `${csrfCookieName}=${encodeURIComponent(csrfCookie.value)}`,
    setCookieHeaders,
    token: csrfCookie.value,
  };
};

export const authenticateProductionSmokeContext = async ({
  account,
  backendUrl,
  context,
}: {
  account: ProductionSmokeAccount;
  backendUrl: string;
  context: BrowserContext;
}) => {
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
    throw new Error(`${account.label} API login did not return an auth cookie.`);
  }

  await context.addCookies(cookies);
};

export const getProductionSmokeAuditPath = () => phaseAuditPath;
export const getProductionDeliveryReliabilityPath = () => phase101DeliveryReliabilityPath;

export const makeSmokeMessageText = () => `phase10 production smoke ${new Date().toISOString()}`;
export const makeDeliverySmokeMessageText = () => `phase10.1 delivery smoke ${new Date().toISOString()}`;

export const appendProductionSmokeAudit = (section: string) => {
  fs.mkdirSync(path.dirname(phaseAuditPath), { recursive: true });
  fs.appendFileSync(phaseAuditPath, `\n\n${section.trim()}\n`, 'utf8');
};

export const appendProductionDeliveryReliabilityAudit = (section: string) => {
  fs.mkdirSync(path.dirname(phase101DeliveryReliabilityPath), { recursive: true });
  fs.appendFileSync(phase101DeliveryReliabilityPath, `\n\n${section.trim()}\n`, 'utf8');
};
