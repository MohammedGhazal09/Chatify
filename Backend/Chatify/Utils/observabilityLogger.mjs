import { randomUUID } from 'node:crypto';

const REDACTED = '[redacted]';
const REDACTED_EMAIL = '[redacted_email]';

const sensitiveKeyPattern = /(?:authorization|bearer|cookie|csrf|credential|headers?|jwt|oauth|password|payload|private|raw|reset(?:code|token)?|sdp|secret|token|ice(?:candidate)?|candidate|email|body|messageText)/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const jwtPattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi;

const isPlainObject = (value) => (
  Boolean(value) &&
  typeof value === 'object' &&
  Object.getPrototypeOf(value) === Object.prototype
);

const sanitizeStringValue = (value) => value
  .replace(bearerPattern, `Bearer ${REDACTED}`)
  .replace(jwtPattern, REDACTED)
  .replace(emailPattern, REDACTED_EMAIL);

export const serializeLogError = (error) => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  return {
    name: error.name ?? 'Error',
    message: sanitizeStringValue(String(error.message ?? 'Unknown error')),
    code: error.code ?? error.codeName,
    statusCode: error.statusCode,
  };
};

export const redactLogMetadata = (value, depth = 0) => {
  if (depth > 6) {
    return '[max_depth]';
  }

  if (value instanceof Error) {
    return serializeLogError(value);
  }

  if (typeof value === 'string') {
    return sanitizeStringValue(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactLogMetadata(item, depth + 1));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      sensitiveKeyPattern.test(key)
        ? REDACTED
        : redactLogMetadata(entryValue, depth + 1),
    ])
  );
};

export const createRequestId = (candidate) => {
  if (
    typeof candidate === 'string' &&
    /^[A-Za-z0-9_.:-]{8,128}$/.test(candidate)
  ) {
    return candidate;
  }

  return randomUUID();
};

export const createLogRecord = ({ level, event, requestId, metadata = {} }) => ({
  ...redactLogMetadata(metadata),
  timestamp: new Date().toISOString(),
  level,
  event,
  ...(requestId ? { requestId } : {}),
});

const shouldWriteLogs = () => (
  process.env.CHATIFY_LOG_LEVEL !== 'silent' &&
  (process.env.NODE_ENV !== 'test' || process.env.CHATIFY_TEST_LOGS === '1')
);

const writeLog = (level, event, metadata = {}) => {
  const record = createLogRecord({
    level,
    event,
    requestId: metadata.requestId,
    metadata,
  });

  if (shouldWriteLogs()) {
    const writer = level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : console.info;
    writer(record);
  }

  return record;
};

export const logger = {
  debug: (event, metadata) => writeLog('debug', event, metadata),
  info: (event, metadata) => writeLog('info', event, metadata),
  warn: (event, metadata) => writeLog('warn', event, metadata),
  error: (event, metadata) => writeLog('error', event, metadata),
};
