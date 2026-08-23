import net from 'node:net';

import { isPublicIpAddress } from './outboundRequestSecurity.mjs';

const DEFAULT_STUN_URLS = ['stun:stun.l.google.com:19302'];
const MAX_ICE_SERVER_URLS = 16;
const MAX_ICE_URL_LENGTH = 512;
const MAX_TURN_USERNAME_LENGTH = 256;
const MAX_TURN_CREDENTIAL_LENGTH = 512;
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

  if (family > 0) {
    return isPublicIpAddress(hostname);
  }

  return isValidDnsHostname(hostname);
};

const normalizeIceUrl = (value, allowedSchemes) => {
  const candidate = typeof value === 'string' ? value.trim() : '';

  if (
    !candidate
    || candidate.length > MAX_ICE_URL_LENGTH
    || CONTROL_CHARACTERS.test(candidate)
  ) {
    return null;
  }

  const match = candidate.match(ICE_URL_PATTERN);
  if (!match) {
    return null;
  }

  const scheme = match[1].toLowerCase();
  const hostToken = match[2].toLowerCase();
  const portToken = match[3] ?? '';
  const transport = match[4]?.toLowerCase() ?? '';

  if (!allowedSchemes.has(scheme) || !isAllowedIceHostname(hostToken)) {
    return null;
  }

  if ((scheme === 'stun' || scheme === 'stuns') && transport) {
    return null;
  }

  if (portToken) {
    const port = Number.parseInt(portToken, 10);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      return null;
    }
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

const normalizeTurnSecret = (value, maxLength) => {
  if (typeof value !== 'string') {
    return '';
  }

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

const parseTurnServers = (env = process.env) => {
  const candidates = splitEnvList(env.CALL_TURN_URLS);
  const username = normalizeTurnSecret(env.CALL_TURN_USERNAME, MAX_TURN_USERNAME_LENGTH);
  const credential = normalizeTurnSecret(env.CALL_TURN_CREDENTIAL, MAX_TURN_CREDENTIAL_LENGTH);
  const normalized = normalizeIceUrlList(candidates, new Set(['turn', 'turns']));

  if (normalized.urls.length === 0 || !username || !credential) {
    return {
      servers: [],
      rejected: normalized.rejected,
    };
  }

  return {
    servers: normalized.urls.map((url) => ({
      urls: url,
      username,
      credential,
    })),
    rejected: normalized.rejected,
  };
};

export const getCallIceConfig = (env = process.env) => {
  const stun = parseStunServers(env);
  const turn = parseTurnServers(env);
  const turnReady = turn.servers.length > 0;
  const productionReady = env.NODE_ENV !== 'production' || turnReady;
  const warnings = [];
  const rejectedCount = stun.rejected + turn.rejected;

  if (rejectedCount > 0) {
    warnings.push(`${rejectedCount} invalid ICE server URL${rejectedCount === 1 ? '' : 's'} ignored.`);
  }

  if (!turnReady) {
    warnings.push('TURN server is not configured. Development STUN fallback is available, but production calling is not fully ready.');
  }

  return {
    iceServers: [...stun.servers, ...turn.servers],
    turnReady,
    productionReady,
    warnings,
  };
};

export const getCallIceReadinessConfig = (env = process.env) => {
  const config = getCallIceConfig(env);

  return {
    ...config,
    iceServers: [],
  };
};
