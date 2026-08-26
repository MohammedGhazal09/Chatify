import { createHmac, randomBytes } from 'node:crypto';
import net from 'node:net';

import { isPublicIpAddress } from './outboundRequestSecurity.mjs';

const DEFAULT_STUN_URLS = ['stun:stun.l.google.com:19302'];
const DEFAULT_TURN_CREDENTIAL_TTL_SECONDS = 600;
const MIN_TURN_CREDENTIAL_TTL_SECONDS = 60;
const MAX_TURN_CREDENTIAL_TTL_SECONDS = 3_600;
const MAX_ICE_SERVER_URLS = 16;
const MAX_ICE_URL_LENGTH = 512;
const MAX_TURN_USERNAME_LENGTH = 256;
const MAX_TURN_SHARED_SECRET_LENGTH = 512;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const ICE_URL_PATTERN = /^(stun|stuns|turn|turns):(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::([0-9]{1,5}))?(?:\?transport=(udp|tcp))?$/i;
const BLOCKED_ICE_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
]);
const BLOCKED_ICE_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.home',
  '.lan',
];
const ENV_HINT_KEYS = new Set([
  'NODE_ENV',
  'CALL_STUN_URLS',
  'CALL_TURN_URLS',
  'CALL_TURN_SHARED_SECRET',
  'CALL_TURN_CREDENTIAL_TTL_SECONDS',
]);

const splitEnvList = (value) => (typeof value === 'string'
  ? value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  : []);

const stripIpv6Brackets = (value) => (
  value.startsWith('[') && value.endsWith(']')
    ? value.slice(1, -1)
    : value
);

const isValidDnsHostname = (hostname) => {
  if (
    !hostname
    || hostname.length > 253
    || hostname.endsWith('.')
    || !hostname.includes('.')
    || BLOCKED_ICE_HOSTS.has(hostname)
    || BLOCKED_ICE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    return false;
  }

  return hostname.split('.').every((label) => (
    label.length >= 1
    && label.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
  ));
};

const isAllowedIceHostname = (hostToken) => {
  const hostname = stripIpv6Brackets(hostToken).toLowerCase();
  const family = net.isIP(hostname);

  if (family > 0) return isPublicIpAddress(hostname);
  return isValidDnsHostname(hostname);
};

const normalizeIceUrl = (value, allowedSchemes) => {
  const candidate = typeof value === 'string' ? value.trim() : '';

  if (!candidate || candidate.length > MAX_ICE_URL_LENGTH || CONTROL_CHARACTERS.test(candidate)) {
    return null;
  }

  const match = candidate.match(ICE_URL_PATTERN);
  if (!match) return null;

  const scheme = match[1].toLowerCase();
  const hostToken = match[2].toLowerCase();
  const portToken = match[3] ?? '';
  const transport = match[4]?.toLowerCase() ?? '';

  if (!allowedSchemes.has(scheme) || !isAllowedIceHostname(hostToken)) return null;
  if ((scheme === 'stun' || scheme === 'stuns') && transport) return null;

  if (portToken) {
    const port = Number.parseInt(portToken, 10);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) return null;
  }

  return `${scheme}:${hostToken}${portToken ? `:${portToken}` : ''}${transport ? `?transport=${transport}` : ''}`;
};

const normalizeIceUrlList = (values, allowedSchemes) => {
  const urls = [];
  const seen = new Set();
  let rejected = 0;

  for (const value of values) {
    if (urls.length >= MAX_ICE_SERVER_URLS) {
      rejected += 1;
      continue;
    }

    const normalized = normalizeIceUrl(value, allowedSchemes);
    if (!normalized) {
      rejected += 1;
      continue;
    }

    if (!seen.has(normalized)) {
      seen.add(normalized);
      urls.push(normalized);
    }
  }

  return { urls, rejected };
};

const normalizeSecret = (value, maxLength) => {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  return normalized
    && normalized.length <= maxLength
    && !CONTROL_CHARACTERS.test(normalized)
    ? normalized
    : '';
};

const parseStunServers = (env = process.env) => {
  const configured = splitEnvList(env.CALL_STUN_URLS);
  const candidates = configured.length > 0 ? configured : DEFAULT_STUN_URLS;
  const normalized = normalizeIceUrlList(candidates, new Set(['stun', 'stuns']));

  return {
    servers: normalized.urls.map((url) => ({ urls: url })),
    rejected: normalized.rejected,
  };
};

const parseCredentialTtlSeconds = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isSafeInteger(parsed) || parsed < MIN_TURN_CREDENTIAL_TTL_SECONDS) {
    return DEFAULT_TURN_CREDENTIAL_TTL_SECONDS;
  }
  return Math.min(parsed, MAX_TURN_CREDENTIAL_TTL_SECONDS);
};

const normalizeCredentialSubject = (value) => String(value ?? '')
  .trim()
  .replace(/[^a-z0-9._-]+/gi, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 96);

const buildTurnRestCredential = ({ env, context = {} }) => {
  const sharedSecret = normalizeSecret(
    env.CALL_TURN_SHARED_SECRET,
    MAX_TURN_SHARED_SECRET_LENGTH
  );
  if (!sharedSecret) return null;

  const ttlSeconds = parseCredentialTtlSeconds(env.CALL_TURN_CREDENTIAL_TTL_SECONDS);
  const suppliedNow = Number(context.nowMs);
  const nowMs = Number.isFinite(suppliedNow) && suppliedNow > 0 ? suppliedNow : Date.now();
  const expiresAt = Math.floor(nowMs / 1000) + ttlSeconds;
  const userId = normalizeCredentialSubject(context.userId);
  const callId = normalizeCredentialSubject(context.callId);
  const subject = [userId, callId].filter(Boolean).join(':')
    || randomBytes(12).toString('base64url');
  const availableSubjectLength = Math.max(
    1,
    MAX_TURN_USERNAME_LENGTH - String(expiresAt).length - 1
  );
  const username = `${expiresAt}:${subject.slice(0, availableSubjectLength)}`;
  const credential = createHmac('sha1', sharedSecret)
    .update(username)
    .digest('base64');

  return {
    username,
    credential,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    ttlSeconds,
  };
};

const parseTurnServers = (env = process.env, context = {}) => {
  const candidates = splitEnvList(env.CALL_TURN_URLS);
  const normalized = normalizeIceUrlList(candidates, new Set(['turn', 'turns']));
  const credential = buildTurnRestCredential({ env, context });

  if (normalized.urls.length === 0 || !credential) {
    return {
      servers: [],
      rejected: normalized.rejected,
      credentialExpiresAt: null,
      credentialTtlSeconds: null,
    };
  }

  return {
    servers: normalized.urls.map((url) => ({
      urls: url,
      username: credential.username,
      credential: credential.credential,
    })),
    rejected: normalized.rejected,
    credentialExpiresAt: credential.expiresAt,
    credentialTtlSeconds: credential.ttlSeconds,
  };
};

const isEnvironmentObject = (value) => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.keys(value).some((key) => ENV_HINT_KEYS.has(key))
);

const resolveArguments = (envOrContext, explicitContext) => (
  isEnvironmentObject(envOrContext)
    ? { env: envOrContext, context: explicitContext ?? {} }
    : { env: process.env, context: envOrContext ?? {} }
);

export const getCallIceConfig = (envOrContext = process.env, explicitContext = {}) => {
  const { env, context } = resolveArguments(envOrContext, explicitContext);
  const stun = parseStunServers(env);
  const turn = parseTurnServers(env, context);
  const turnReady = turn.servers.length > 0;
  const productionReady = env.NODE_ENV !== 'production' || turnReady;
  const warnings = [];
  const rejectedCount = stun.rejected + turn.rejected;

  if (rejectedCount > 0) {
    warnings.push(`${rejectedCount} invalid ICE server URL${rejectedCount === 1 ? '' : 's'} ignored.`);
  }

  if (!turnReady) {
    warnings.push('TURN server or shared secret is not configured. Development STUN fallback is available, but production calling is not fully ready.');
  }

  return {
    iceServers: [...stun.servers, ...turn.servers],
    turnReady,
    productionReady,
    credentialExpiresAt: turn.credentialExpiresAt,
    credentialTtlSeconds: turn.credentialTtlSeconds,
    warnings,
  };
};

export const getCallIceReadinessConfig = (env = process.env) => {
  const config = getCallIceConfig(env, { readinessOnly: true });

  return {
    ...config,
    iceServers: [],
    credentialExpiresAt: null,
  };
};
