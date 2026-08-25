import { lookup as dnsLookup } from 'node:dns';
import https from 'node:https';
import net from 'node:net';

export const OUTBOUND_URL_ERROR_CODES = Object.freeze({
  INVALID_URL: 'OUTBOUND_URL_INVALID',
  HTTPS_REQUIRED: 'OUTBOUND_HTTPS_REQUIRED',
  CREDENTIALS_FORBIDDEN: 'OUTBOUND_CREDENTIALS_FORBIDDEN',
  PORT_FORBIDDEN: 'OUTBOUND_PORT_FORBIDDEN',
  FRAGMENT_FORBIDDEN: 'OUTBOUND_FRAGMENT_FORBIDDEN',
  HOST_FORBIDDEN: 'OUTBOUND_HOST_FORBIDDEN',
  ADDRESS_FORBIDDEN: 'OUTBOUND_ADDRESS_FORBIDDEN',
  DNS_FAILED: 'OUTBOUND_DNS_FAILED',
});

const MAX_OUTBOUND_URL_LENGTH = 2_048;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
]);
const BLOCKED_HOST_SUFFIXES = Object.freeze([
  '.localhost',
  '.local',
  '.internal',
  '.home',
  '.lan',
]);

const IPV4_BLOCKS = Object.freeze([
  [0x00000000, 0xff000000], // 0.0.0.0/8
  [0x0a000000, 0xff000000], // 10.0.0.0/8
  [0x64400000, 0xffc00000], // 100.64.0.0/10
  [0x7f000000, 0xff000000], // 127.0.0.0/8
  [0xa9fe0000, 0xffff0000], // 169.254.0.0/16
  [0xac100000, 0xfff00000], // 172.16.0.0/12
  [0xc0000000, 0xffffff00], // 192.0.0.0/24
  [0xc0000200, 0xffffff00], // 192.0.2.0/24
  [0xc0586300, 0xffffff00], // 192.88.99.0/24
  [0xc0a80000, 0xffff0000], // 192.168.0.0/16
  [0xc6120000, 0xfffe0000], // 198.18.0.0/15
  [0xc6336400, 0xffffff00], // 198.51.100.0/24
  [0xcb007100, 0xffffff00], // 203.0.113.0/24
  [0xe0000000, 0xf0000000], // 224.0.0.0/4
  [0xf0000000, 0xf0000000], // 240.0.0.0/4
]);

const createOutboundError = (code, message, cause) => {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
};

const failure = (code, message) => ({
  ok: false,
  code,
  message,
});

const stripIpv6Brackets = (value) => (
  value.startsWith('[') && value.endsWith(']')
    ? value.slice(1, -1)
    : value
);

const parseIpv4 = (address) => {
  if (net.isIP(address) !== 4) return null;
  const octets = address.split('.').map((part) => Number.parseInt(part, 10));
  return (
    ((octets[0] << 24) >>> 0)
    + (octets[1] << 16)
    + (octets[2] << 8)
    + octets[3]
  ) >>> 0;
};

const isPublicIpv4 = (address) => {
  const value = parseIpv4(address);
  if (value === null) return false;

  return !IPV4_BLOCKS.some(([network, mask]) => (
    ((value & mask) >>> 0) === ((network & mask) >>> 0)
  ));
};

const parseIpv6 = (address) => {
  let value = stripIpv6Brackets(String(address ?? '').trim().toLowerCase());
  const zoneIndex = value.indexOf('%');
  if (zoneIndex >= 0) value = value.slice(0, zoneIndex);
  if (net.isIP(value) !== 6) return null;

  if (value.includes('.')) {
    const lastColon = value.lastIndexOf(':');
    const ipv4Value = parseIpv4(value.slice(lastColon + 1));
    if (ipv4Value === null) return null;
    const high = ((ipv4Value >>> 16) & 0xffff).toString(16);
    const low = (ipv4Value & 0xffff).toString(16);
    value = `${value.slice(0, lastColon + 1)}${high}:${low}`;
  }

  const halves = value.split('::');
  if (halves.length > 2) return null;
  const parseHalf = (half) => (
    half
      ? half.split(':').map((part) => Number.parseInt(part, 16))
      : []
  );
  const left = parseHalf(halves[0]);
  const right = parseHalf(halves[1] ?? '');
  const missing = 8 - left.length - right.length;

  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = halves.length === 2
    ? [...left, ...Array(missing).fill(0), ...right]
    : left;

  return groups.length === 8 && groups.every((group) => (
    Number.isInteger(group) && group >= 0 && group <= 0xffff
  ))
    ? groups
    : null;
};

const ipv4FromIpv6Tail = (groups) => {
  const high = groups[6];
  const low = groups[7];
  return [
    high >>> 8,
    high & 0xff,
    low >>> 8,
    low & 0xff,
  ].join('.');
};

const isPublicIpv6 = (address) => {
  const groups = parseIpv6(address);
  if (!groups) return false;

  const firstFiveZero = groups.slice(0, 5).every((group) => group === 0);
  if (firstFiveZero && (groups[5] === 0 || groups[5] === 0xffff)) {
    return isPublicIpv4(ipv4FromIpv6Tail(groups));
  }

  const first = groups[0];
  const second = groups[1];

  if ((first & 0xfe00) === 0xfc00) return false; // Unique local fc00::/7
  if ((first & 0xffc0) === 0xfe80) return false; // Link-local fe80::/10
  if ((first & 0xffc0) === 0xfec0) return false; // Deprecated site-local fec0::/10
  if ((first & 0xff00) === 0xff00) return false; // Multicast ff00::/8
  if (first === 0x0064 && second === 0xff9b) return false; // NAT64 translation prefixes
  if (first === 0x0100 && groups.slice(1, 4).every((group) => group === 0)) return false;
  if (first === 0x2001 && second === 0x0000) return false; // Teredo
  if (first === 0x2001 && (second & 0xfff0) === 0x0010) return false; // ORCHID
  if (first === 0x2001 && second === 0x0db8) return false; // Documentation
  if (first === 0x2002) return false; // 6to4 can tunnel private IPv4 destinations

  return (first & 0xe000) === 0x2000; // Globally routable unicast allocation
};

export const isPublicIpAddress = (address) => {
  const normalized = stripIpv6Brackets(String(address ?? '').trim());
  const family = net.isIP(normalized);
  if (family === 4) return isPublicIpv4(normalized);
  if (family === 6) return isPublicIpv6(normalized);
  return false;
};

const normalizeHostname = (value) => stripIpv6Brackets(String(value ?? '').trim().toLowerCase());

const isBlockedHostname = (hostname) => {
  if (!hostname || hostname.endsWith('.')) return true;
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return true;
  if (net.isIP(hostname) === 0 && !hostname.includes('.')) return true;
  return false;
};

export const normalizeOutboundHttpsUrl = (value, {
  maxLength = MAX_OUTBOUND_URL_LENGTH,
} = {}) => {
  const candidate = typeof value === 'string' ? value.trim() : '';

  if (!candidate || candidate.length > maxLength || CONTROL_CHARACTERS.test(candidate)) {
    return failure(OUTBOUND_URL_ERROR_CODES.INVALID_URL, 'Outbound URL is invalid');
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return failure(OUTBOUND_URL_ERROR_CODES.INVALID_URL, 'Outbound URL is invalid');
  }

  if (parsed.protocol !== 'https:') {
    return failure(OUTBOUND_URL_ERROR_CODES.HTTPS_REQUIRED, 'Outbound URL must use HTTPS');
  }
  if (parsed.username || parsed.password) {
    return failure(
      OUTBOUND_URL_ERROR_CODES.CREDENTIALS_FORBIDDEN,
      'Outbound URL credentials are not allowed'
    );
  }
  if (parsed.port && parsed.port !== '443') {
    return failure(
      OUTBOUND_URL_ERROR_CODES.PORT_FORBIDDEN,
      'Outbound URL must use the standard HTTPS port'
    );
  }
  if (parsed.hash) {
    return failure(
      OUTBOUND_URL_ERROR_CODES.FRAGMENT_FORBIDDEN,
      'Outbound URL fragments are not allowed'
    );
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (isBlockedHostname(hostname)) {
    return failure(OUTBOUND_URL_ERROR_CODES.HOST_FORBIDDEN, 'Outbound hostname is not allowed');
  }
  if (net.isIP(hostname) > 0 && !isPublicIpAddress(hostname)) {
    return failure(
      OUTBOUND_URL_ERROR_CODES.ADDRESS_FORBIDDEN,
      'Outbound destination address is not publicly routable'
    );
  }

  return {
    ok: true,
    url: parsed.toString(),
    hostname,
    origin: parsed.origin,
  };
};

const normalizeLookupRecords = (addresses, family) => {
  const records = Array.isArray(addresses)
    ? addresses
    : [{ address: addresses, family }];
  const unique = new Map();

  for (const record of records) {
    const address = typeof record === 'string' ? record : record?.address;
    const detectedFamily = net.isIP(address);
    const recordFamily = typeof record === 'object' && Number(record.family)
      ? Number(record.family)
      : detectedFamily;

    if (!address || !detectedFamily || recordFamily !== detectedFamily) continue;
    unique.set(`${detectedFamily}:${address}`, {
      address,
      family: detectedFamily,
    });
  }

  return [...unique.values()];
};

export const createRestrictedLookup = ({ lookup = dnsLookup } = {}) => {
  if (typeof lookup !== 'function') {
    throw new TypeError('A DNS lookup function is required');
  }

  return (hostname, options, callback) => {
    let requestedOptions = options;
    let done = callback;

    if (typeof options === 'function') {
      done = options;
      requestedOptions = {};
    } else if (typeof options === 'number') {
      requestedOptions = { family: options };
    }

    const normalizedOptions = requestedOptions && typeof requestedOptions === 'object'
      ? requestedOptions
      : {};
    const normalizedHostname = normalizeHostname(hostname);

    if (isBlockedHostname(normalizedHostname)) {
      done(createOutboundError(
        OUTBOUND_URL_ERROR_CODES.HOST_FORBIDDEN,
        'Outbound hostname is not allowed'
      ));
      return;
    }

    try {
      lookup(normalizedHostname, { all: true, verbatim: true }, (error, addresses, family) => {
        if (error) {
          done(createOutboundError(
            OUTBOUND_URL_ERROR_CODES.DNS_FAILED,
            'Outbound destination DNS lookup failed',
            error
          ));
          return;
        }

        const records = normalizeLookupRecords(addresses, family);
        if (records.length === 0) {
          done(createOutboundError(
            OUTBOUND_URL_ERROR_CODES.DNS_FAILED,
            'Outbound destination did not resolve to an address'
          ));
          return;
        }

        if (records.some((record) => !isPublicIpAddress(record.address))) {
          done(createOutboundError(
            OUTBOUND_URL_ERROR_CODES.ADDRESS_FORBIDDEN,
            'Outbound destination resolved to a non-public address'
          ));
          return;
        }

        const requestedFamily = Number(normalizedOptions.family) || 0;
        const usableRecords = requestedFamily
          ? records.filter((record) => record.family === requestedFamily)
          : records;

        if (usableRecords.length === 0) {
          done(createOutboundError(
            OUTBOUND_URL_ERROR_CODES.DNS_FAILED,
            'Outbound destination has no address for the requested family'
          ));
          return;
        }

        if (normalizedOptions.all === true) {
          done(null, usableRecords);
          return;
        }

        done(null, usableRecords[0].address, usableRecords[0].family);
      });
    } catch (error) {
      done(createOutboundError(
        OUTBOUND_URL_ERROR_CODES.DNS_FAILED,
        'Outbound destination DNS lookup failed',
        error
      ));
    }
  };
};

export const createRestrictedHttpsAgent = ({
  lookup = dnsLookup,
  maxSockets = 25,
} = {}) => new https.Agent({
  keepAlive: false,
  maxSockets,
  maxFreeSockets: 0,
  lookup: createRestrictedLookup({ lookup }),
});
