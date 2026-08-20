import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { hash as hashArgon2, verify as verifyArgon2 } from 'argon2';
import { CustomError } from './customError.mjs';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const BACKUP_CODE_COUNT = 10;

export const normalizeTotpCode = (code) => String(code ?? '').replace(/\s+/g, '');

export const normalizeBackupCode = (code) => String(code ?? '')
  .replace(/[\s-]+/g, '')
  .toUpperCase();

export const encodeBase32 = (buffer) => {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
};

const decodeBase32 = (value) => {
  const input = String(value ?? '').replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let current = 0;
  const bytes = [];

  for (const char of input) {
    const index = BASE32_ALPHABET.indexOf(char);

    if (index === -1) {
      throw new CustomError('Two-factor secret is invalid', 500);
    }

    current = (current << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((current >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
};

export const generateTwoFactorSecret = () => encodeBase32(randomBytes(20));

export const buildOtpAuthUrl = ({ email, secret }) => {
  const issuer = 'Chatify';
  const label = `${issuer}:${email}`;
  const url = new URL(`otpauth://totp/${encodeURIComponent(label)}`);

  url.searchParams.set('secret', secret);
  url.searchParams.set('issuer', issuer);
  url.searchParams.set('algorithm', 'SHA1');
  url.searchParams.set('digits', String(TOTP_DIGITS));
  url.searchParams.set('period', String(TOTP_PERIOD_SECONDS));

  return url.toString();
};

const getTotpCounter = (now = Date.now()) => Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);

const generateTotpForCounter = (secret, counter) => {
  const key = decodeBase32(secret);
  const counterBuffer = Buffer.alloc(8);

  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', key).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0xf;
  const binary = (
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  );

  return String(binary % (10 ** TOTP_DIGITS)).padStart(TOTP_DIGITS, '0');
};

export const generateTotpCode = (secret, now = Date.now()) => (
  generateTotpForCounter(secret, getTotpCounter(now))
);

export const verifyTotpCode = (secret, code, { now = Date.now(), window = TOTP_WINDOW } = {}) => {
  const normalized = normalizeTotpCode(code);

  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }

  const currentCounter = getTotpCounter(now);
  const expectedBuffer = Buffer.from(normalized);

  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = generateTotpForCounter(secret, currentCounter + offset);
    const candidateBuffer = Buffer.from(candidate);

    if (
      expectedBuffer.length === candidateBuffer.length &&
      expectedBuffer.length > 0 &&
      cryptoSafeEqual(expectedBuffer, candidateBuffer)
    ) {
      return true;
    }
  }

  return false;
};

const cryptoSafeEqual = (left, right) => {
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
};

const decodeConfiguredEncryptionKey = (value) => {
  const trimmed = String(value ?? '').trim();

  if (!trimmed) {
    return null;
  }

  const base64Key = Buffer.from(trimmed, 'base64');
  if (base64Key.length === 32) {
    return base64Key;
  }

  if (/^[a-f0-9]{64}$/i.test(trimmed)) {
    const hexKey = Buffer.from(trimmed, 'hex');
    if (hexKey.length === 32) {
      return hexKey;
    }
  }

  return null;
};

const getTwoFactorEncryptionKey = () => {
  const configuredKey = decodeConfiguredEncryptionKey(process.env.TWO_FACTOR_ENCRYPTION_KEY);

  if (configuredKey) {
    return configuredKey;
  }

  if (process.env.TWO_FACTOR_ENCRYPTION_KEY) {
    throw new CustomError('Two-factor encryption key is invalid', 500);
  }

  if (process.env.NODE_ENV === 'production') {
    throw new CustomError('Two-factor setup is temporarily unavailable', 500);
  }

  if (!process.env.SECRET_JWT_KEY) {
    throw new CustomError('Two-factor setup is temporarily unavailable', 500);
  }

  return createHash('sha256').update(process.env.SECRET_JWT_KEY).digest();
};

export const encryptTwoFactorSecret = (secret) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getTwoFactorEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    algorithm: ENCRYPTION_ALGORITHM,
    iv: iv.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
    authTag: authTag.toString('base64url'),
  };
};

export const decryptTwoFactorSecret = (record) => {
  if (!record?.iv || !record?.ciphertext || !record?.authTag) {
    throw new CustomError('Two-factor secret is unavailable', 500);
  }

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getTwoFactorEncryptionKey(),
    Buffer.from(record.iv, 'base64url')
  );

  decipher.setAuthTag(Buffer.from(record.authTag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};

const generateBackupCode = () => {
  const raw = encodeBase32(randomBytes(6)).slice(0, 10);
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
};

export const createBackupCodeSet = async (count = BACKUP_CODE_COUNT) => {
  const codes = Array.from({ length: count }, generateBackupCode);
  const now = new Date();
  const records = await Promise.all(codes.map(async (code) => ({
    codeHash: await hashArgon2(normalizeBackupCode(code)),
    createdAt: now,
    usedAt: null,
  })));

  return { codes, records };
};

export const findMatchingBackupCodeIndex = async (backupCodes = [], code) => {
  const normalized = normalizeBackupCode(code);

  if (!/^[A-Z2-7]{8,20}$/.test(normalized)) {
    return -1;
  }

  for (let index = 0; index < backupCodes.length; index += 1) {
    const backupCode = backupCodes[index];

    if (!backupCode?.codeHash || backupCode.usedAt) {
      continue;
    }

    try {
      if (await verifyArgon2(backupCode.codeHash, normalized)) {
        return index;
      }
    } catch {
      continue;
    }
  }

  return -1;
};

export const hashTwoFactorChallengeToken = (token) => (
  createHash('sha256').update(String(token)).digest('base64url')
);

export const createTwoFactorChallengeToken = () => randomBytes(48).toString('base64url');
