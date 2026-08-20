import type { Chat, EncryptedPayload, EncryptionMode, Message } from '../types/chat';

const CONVERSATION_SECRET_PREFIX = 'chatify:e2ee:v1:conversation-secret:';
const DEVICE_ID_STORAGE_KEY = 'chatify:e2ee:v1:device-id';
const RECOVERY_KEY_PREFIX = 'chatify-e2ee-v1:';
const ENCRYPTION_ALGORITHM = 'AES-GCM';
const ENCRYPTION_KEY_VERSION = 1;
const AES_GCM_IV_BYTES = 12;
const AES_256_KEY_BYTES = 32;

type DecryptFailureReason = 'missing-secret' | 'invalid-payload' | 'decrypt-failed';
type RecoveryExportFailureReason = 'missing-secret' | 'invalid-secret';
export type RecoveryImportFailureReason =
  | 'empty'
  | 'format'
  | 'version'
  | 'chat-mismatch'
  | 'secret-invalid'
  | 'storage-unavailable';

export type EncryptedDecryptResult =
  | { ok: true; text: string }
  | { ok: false; reason: DecryptFailureReason };

export type ConversationRecoveryKeyExportResult =
  | { ok: true; recoveryKey: string }
  | { ok: false; reason: RecoveryExportFailureReason };

export type ConversationRecoveryKeyImportResult =
  | { ok: true }
  | { ok: false; reason: RecoveryImportFailureReason };

interface RecoveryKeyEnvelope {
  version: number;
  chatId: string;
  algorithm: typeof ENCRYPTION_ALGORITHM;
  keyVersion: number;
  keyBytes: number;
  secret: string;
}

export const isEncryptedConversation = (chat?: Pick<Chat, 'encryptionMode'> | null) => (
  chat?.encryptionMode === 'e2ee_v1'
);

export const isEncryptedMessage = (message?: Pick<Message, 'messageType' | 'encryptionMode'> | null) => (
  message?.messageType === 'encrypted' || message?.encryptionMode === 'e2ee_v1'
);

const hasStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const getSecretStorageKey = (chatId: string) => `${CONVERSATION_SECRET_PREFIX}${chatId}`;

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const encodeJsonToBase64 = (value: unknown) => (
  bytesToBase64(new TextEncoder().encode(JSON.stringify(value)))
);

const decodeJsonFromBase64 = (value: string) => {
  const bytes = base64ToBytes(value);
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
};

const getCrypto = () => {
  const cryptoApi = globalThis.crypto;

  if (!cryptoApi?.subtle || typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('This browser cannot encrypt messages on this device.');
  }

  return cryptoApi;
};

export const generateConversationSecret = () => {
  const secretBytes = new Uint8Array(AES_256_KEY_BYTES);
  getCrypto().getRandomValues(secretBytes);
  return bytesToBase64(secretBytes);
};

export const saveConversationSecret = (chatId: string, secret: string) => {
  if (!chatId || !secret || !hasStorage()) {
    return;
  }

  window.localStorage.setItem(getSecretStorageKey(chatId), secret);
};

export const ensureConversationSecret = (chatId: string) => {
  const existingSecret = getConversationSecret(chatId);

  if (existingSecret) {
    return existingSecret;
  }

  const secret = generateConversationSecret();
  saveConversationSecret(chatId, secret);
  return secret;
};

export const getConversationSecret = (chatId: string) => {
  if (!chatId || !hasStorage()) {
    return null;
  }

  return window.localStorage.getItem(getSecretStorageKey(chatId));
};

export const hasConversationSecret = (chatId?: string | null) => (
  Boolean(chatId && getConversationSecret(chatId))
);

export const clearConversationSecret = (chatId: string) => {
  if (!chatId || !hasStorage()) {
    return;
  }

  window.localStorage.removeItem(getSecretStorageKey(chatId));
};

const isValidConversationSecret = (secret: string) => {
  try {
    return base64ToBytes(secret).byteLength === AES_256_KEY_BYTES;
  } catch {
    return false;
  }
};

const isRecoveryKeyEnvelope = (value: unknown): value is RecoveryKeyEnvelope => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const envelope = value as Partial<RecoveryKeyEnvelope>;

  return (
    typeof envelope.version === 'number' &&
    typeof envelope.chatId === 'string' &&
    envelope.algorithm === ENCRYPTION_ALGORITHM &&
    typeof envelope.keyVersion === 'number' &&
    typeof envelope.keyBytes === 'number' &&
    typeof envelope.secret === 'string'
  );
};

export const exportConversationRecoveryKey = (chatId: string): ConversationRecoveryKeyExportResult => {
  const secret = getConversationSecret(chatId);

  if (!secret) {
    return { ok: false, reason: 'missing-secret' };
  }

  if (!isValidConversationSecret(secret)) {
    return { ok: false, reason: 'invalid-secret' };
  }

  return {
    ok: true,
    recoveryKey: `${RECOVERY_KEY_PREFIX}${encodeJsonToBase64({
      version: 1,
      chatId,
      algorithm: ENCRYPTION_ALGORITHM,
      keyVersion: ENCRYPTION_KEY_VERSION,
      keyBytes: AES_256_KEY_BYTES,
      secret,
    } satisfies RecoveryKeyEnvelope)}`,
  };
};

export const importConversationRecoveryKey = (
  chatId: string,
  recoveryKey: string
): ConversationRecoveryKeyImportResult => {
  const normalizedRecoveryKey = recoveryKey.trim();

  if (!chatId || !normalizedRecoveryKey) {
    return { ok: false, reason: 'empty' };
  }

  if (!hasStorage()) {
    return { ok: false, reason: 'storage-unavailable' };
  }

  if (!normalizedRecoveryKey.startsWith(RECOVERY_KEY_PREFIX)) {
    return { ok: false, reason: 'format' };
  }

  let envelope: unknown;
  try {
    envelope = decodeJsonFromBase64(normalizedRecoveryKey.slice(RECOVERY_KEY_PREFIX.length));
  } catch {
    return { ok: false, reason: 'format' };
  }

  if (!isRecoveryKeyEnvelope(envelope)) {
    return { ok: false, reason: 'format' };
  }

  if (envelope.version !== 1 || envelope.keyVersion !== ENCRYPTION_KEY_VERSION || envelope.keyBytes !== AES_256_KEY_BYTES) {
    return { ok: false, reason: 'version' };
  }

  if (envelope.chatId !== chatId) {
    return { ok: false, reason: 'chat-mismatch' };
  }

  if (!isValidConversationSecret(envelope.secret)) {
    return { ok: false, reason: 'secret-invalid' };
  }

  saveConversationSecret(chatId, envelope.secret);
  return { ok: true };
};

export const getLocalEncryptionDeviceId = () => {
  if (!hasStorage()) {
    return 'browser-device';
  }

  const existingDeviceId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existingDeviceId) {
    return existingDeviceId;
  }

  const deviceId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  return deviceId;
};

const importConversationKey = async (secret: string) => {
  const keyBytes = base64ToBytes(secret);

  if (keyBytes.byteLength !== AES_256_KEY_BYTES) {
    throw new Error('Conversation secret is invalid on this device.');
  }

  return getCrypto().subtle.importKey(
    'raw',
    keyBytes,
    { name: ENCRYPTION_ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  );
};

export const encryptMessageText = async ({
  chatId,
  text,
  encryptionMode,
}: {
  chatId: string;
  text: string;
  encryptionMode: EncryptionMode;
}): Promise<EncryptedPayload> => {
  if (encryptionMode !== 'e2ee_v1') {
    throw new Error('Conversation is not encrypted.');
  }

  const secret = getConversationSecret(chatId);

  if (!secret) {
    throw new Error('This device needs the conversation secret to send encrypted messages.');
  }

  const cryptoApi = getCrypto();
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  cryptoApi.getRandomValues(iv);
  const key = await importConversationKey(secret);
  const ciphertext = await cryptoApi.subtle.encrypt(
    { name: ENCRYPTION_ALGORITHM, iv },
    key,
    new TextEncoder().encode(text)
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    algorithm: ENCRYPTION_ALGORITHM,
    keyVersion: ENCRYPTION_KEY_VERSION,
    senderDeviceId: getLocalEncryptionDeviceId(),
    encryptedAt: new Date().toISOString(),
  };
};

const isValidEncryptedPayload = (payload?: EncryptedPayload | null): payload is EncryptedPayload => (
  Boolean(
    payload &&
    typeof payload.ciphertext === 'string' &&
    typeof payload.iv === 'string' &&
    payload.algorithm === ENCRYPTION_ALGORITHM &&
    Number(payload.keyVersion) === ENCRYPTION_KEY_VERSION
  )
);

export const decryptMessageText = async (
  chatId: string,
  payload?: EncryptedPayload | null
): Promise<EncryptedDecryptResult> => {
  if (!isValidEncryptedPayload(payload)) {
    return { ok: false, reason: 'invalid-payload' };
  }

  const secret = getConversationSecret(chatId);
  if (!secret) {
    return { ok: false, reason: 'missing-secret' };
  }

  try {
    const key = await importConversationKey(secret);
    const plaintext = await getCrypto().subtle.decrypt(
      { name: ENCRYPTION_ALGORITHM, iv: base64ToBytes(payload.iv) },
      key,
      base64ToBytes(payload.ciphertext)
    );

    return { ok: true, text: new TextDecoder().decode(plaintext) };
  } catch {
    return { ok: false, reason: 'decrypt-failed' };
  }
};
