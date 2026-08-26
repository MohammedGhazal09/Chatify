import type { Chat, EncryptedPayload, EncryptionMode, Message } from '../types/chat';

const LEGACY_CONVERSATION_SECRET_PREFIX = 'chatify:e2ee:v1:conversation-secret:';
const WRAPPED_CONVERSATION_SECRET_PREFIX = 'chatify:e2ee:v2:wrapped-secret:';
const DEVICE_ID_STORAGE_KEY = 'chatify:e2ee:v2:device-id';
const RECOVERY_KEY_PREFIX = 'chatify-e2ee-v1:';
const VAULT_DATABASE_NAME = 'chatify-e2ee-key-vault';
const VAULT_DATABASE_VERSION = 1;
const VAULT_KEY_STORE = 'wrapping-keys';
const ENCRYPTION_ALGORITHM = 'AES-GCM';
const ENCRYPTION_KEY_VERSION = 1;
const WRAPPED_SECRET_VERSION = 2;
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

interface WrappedSecretEnvelope {
  version: typeof WRAPPED_SECRET_VERSION;
  algorithm: typeof ENCRYPTION_ALGORITHM;
  iv: string;
  ciphertext: string;
}

const secretCache = new Map<string, string>();
let activeAccountId: string | null = null;
let activeDeviceId: string | null = null;
let activeWrappingKey: CryptoKey | null = null;
let vaultGeneration = 0;
let vaultReady: Promise<void> = Promise.resolve();

export const isEncryptedConversation = (chat?: Pick<Chat, 'encryptionMode'> | null) => (
  chat?.encryptionMode === 'e2ee_v1'
);

export const isEncryptedMessage = (message?: Pick<Message, 'messageType' | 'encryptionMode'> | null) => (
  message?.messageType === 'encrypted' || message?.encryptionMode === 'e2ee_v1'
);

const hasLocalStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);
const hasIndexedDb = () => typeof window !== 'undefined' && Boolean(window.indexedDB);

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

const normalizeAccountId = (value: string | null | undefined) => String(value ?? '').trim();

export const getLocalEncryptionDeviceId = () => {
  if (!hasLocalStorage()) {
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

const getVaultKeyId = (accountId: string, deviceId: string) => `${accountId}:${deviceId}`;
const getAccountStoragePrefix = (accountId: string, deviceId: string) => (
  `${WRAPPED_CONVERSATION_SECRET_PREFIX}${encodeURIComponent(accountId)}:${encodeURIComponent(deviceId)}:`
);
const getSecretStorageKey = (accountId: string, deviceId: string, chatId: string) => (
  `${getAccountStoragePrefix(accountId, deviceId)}${encodeURIComponent(chatId)}`
);
const getAdditionalData = (accountId: string, deviceId: string, chatId: string) => (
  new TextEncoder().encode(`${accountId}\0${deviceId}\0${chatId}`)
);

const requestResult = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Encrypted key vault request failed'));
});

const transactionCompleted = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error ?? new Error('Encrypted key vault transaction failed'));
  transaction.onabort = () => reject(transaction.error ?? new Error('Encrypted key vault transaction aborted'));
});

const openVaultDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!hasIndexedDb()) {
    reject(new Error('IndexedDB is unavailable'));
    return;
  }

  const request = window.indexedDB.open(VAULT_DATABASE_NAME, VAULT_DATABASE_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(VAULT_KEY_STORE)) {
      request.result.createObjectStore(VAULT_KEY_STORE);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Encrypted key vault could not be opened'));
});

const getOrCreateWrappingKey = async (keyId: string) => {
  const database = await openVaultDatabase();

  try {
    const readTransaction = database.transaction(VAULT_KEY_STORE, 'readonly');
    const existing = await requestResult(readTransaction.objectStore(VAULT_KEY_STORE).get(keyId));
    await transactionCompleted(readTransaction);

    if (existing && typeof existing === 'object') {
      return existing as CryptoKey;
    }

    const generated = await getCrypto().subtle.generateKey(
      { name: ENCRYPTION_ALGORITHM, length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    const writeTransaction = database.transaction(VAULT_KEY_STORE, 'readwrite');
    writeTransaction.objectStore(VAULT_KEY_STORE).put(generated, keyId);
    await transactionCompleted(writeTransaction);
    return generated;
  } finally {
    database.close();
  }
};

const isValidConversationSecret = (secret: string) => {
  try {
    return base64ToBytes(secret).byteLength === AES_256_KEY_BYTES;
  } catch {
    return false;
  }
};

const isWrappedSecretEnvelope = (value: unknown): value is WrappedSecretEnvelope => {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as Partial<WrappedSecretEnvelope>;
  return envelope.version === WRAPPED_SECRET_VERSION
    && envelope.algorithm === ENCRYPTION_ALGORITHM
    && typeof envelope.iv === 'string'
    && typeof envelope.ciphertext === 'string';
};

const removeLegacyPlaintextSecrets = () => {
  if (!hasLocalStorage()) return;

  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(LEGACY_CONVERSATION_SECRET_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => window.localStorage.removeItem(key));
};

const decryptStoredSecret = async ({
  envelope,
  accountId,
  deviceId,
  chatId,
  key,
}: {
  envelope: WrappedSecretEnvelope;
  accountId: string;
  deviceId: string;
  chatId: string;
  key: CryptoKey;
}) => {
  const plaintext = await getCrypto().subtle.decrypt(
    {
      name: ENCRYPTION_ALGORITHM,
      iv: base64ToBytes(envelope.iv),
      additionalData: getAdditionalData(accountId, deviceId, chatId),
    },
    key,
    base64ToBytes(envelope.ciphertext)
  );
  return new TextDecoder().decode(plaintext);
};

const loadStoredSecrets = async ({
  accountId,
  deviceId,
  key,
  generation,
}: {
  accountId: string;
  deviceId: string;
  key: CryptoKey;
  generation: number;
}) => {
  if (!hasLocalStorage()) return;

  const prefix = getAccountStoragePrefix(accountId, deviceId);
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const storageKey = window.localStorage.key(index);
    if (storageKey?.startsWith(prefix)) keys.push(storageKey);
  }

  for (const storageKey of keys) {
    if (generation !== vaultGeneration) return;
    const chatId = decodeURIComponent(storageKey.slice(prefix.length));

    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as unknown;
      if (!isWrappedSecretEnvelope(parsed)) throw new Error('Invalid wrapped secret');
      const secret = await decryptStoredSecret({
        envelope: parsed,
        accountId,
        deviceId,
        chatId,
        key,
      });
      if (!isValidConversationSecret(secret)) throw new Error('Invalid conversation secret');
      secretCache.set(chatId, secret);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }
};

export const lockConversationKeyVault = () => {
  vaultGeneration += 1;
  activeAccountId = null;
  activeDeviceId = null;
  activeWrappingKey = null;
  secretCache.clear();
  vaultReady = Promise.resolve();
};

export const setConversationKeyAccount = (accountId: string | null | undefined) => {
  const normalizedAccountId = normalizeAccountId(accountId);

  if (normalizedAccountId && normalizedAccountId === activeAccountId) {
    return vaultReady;
  }

  const generation = ++vaultGeneration;
  activeAccountId = normalizedAccountId || null;
  activeDeviceId = normalizedAccountId ? getLocalEncryptionDeviceId() : null;
  activeWrappingKey = null;
  secretCache.clear();
  removeLegacyPlaintextSecrets();

  if (!activeAccountId || !activeDeviceId) {
    vaultReady = Promise.resolve();
    return vaultReady;
  }

  const account = activeAccountId;
  const device = activeDeviceId;
  vaultReady = (async () => {
    try {
      const key = await getOrCreateWrappingKey(getVaultKeyId(account, device));
      if (generation !== vaultGeneration) return;
      activeWrappingKey = key;
      await loadStoredSecrets({ accountId: account, deviceId: device, key, generation });
    } catch {
      // Fail closed to an in-memory-only vault when persistent secure storage is unavailable.
      if (generation === vaultGeneration) activeWrappingKey = null;
    }
  })();

  return vaultReady;
};

const persistConversationSecret = async ({
  chatId,
  secret,
  generation,
}: {
  chatId: string;
  secret: string;
  generation: number;
}) => {
  await vaultReady;

  if (
    generation !== vaultGeneration
    || !activeAccountId
    || !activeDeviceId
    || !activeWrappingKey
    || !hasLocalStorage()
  ) {
    return;
  }

  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  getCrypto().getRandomValues(iv);
  const ciphertext = await getCrypto().subtle.encrypt(
    {
      name: ENCRYPTION_ALGORITHM,
      iv,
      additionalData: getAdditionalData(activeAccountId, activeDeviceId, chatId),
    },
    activeWrappingKey,
    new TextEncoder().encode(secret)
  );
  const envelope: WrappedSecretEnvelope = {
    version: WRAPPED_SECRET_VERSION,
    algorithm: ENCRYPTION_ALGORITHM,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
  window.localStorage.setItem(
    getSecretStorageKey(activeAccountId, activeDeviceId, chatId),
    JSON.stringify(envelope)
  );
};

export const generateConversationSecret = () => {
  const secretBytes = new Uint8Array(AES_256_KEY_BYTES);
  getCrypto().getRandomValues(secretBytes);
  return bytesToBase64(secretBytes);
};

export const saveConversationSecret = (chatId: string, secret: string) => {
  if (!chatId || !secret || !activeAccountId || !isValidConversationSecret(secret)) return;

  secretCache.set(chatId, secret);
  const generation = vaultGeneration;
  void persistConversationSecret({ chatId, secret, generation }).catch(() => undefined);
};

export const ensureConversationSecret = (chatId: string) => {
  if (!chatId || !activeAccountId) {
    throw new Error('An authenticated account is required to store an encrypted conversation secret.');
  }

  const existingSecret = getConversationSecret(chatId);
  if (existingSecret) return existingSecret;

  const secret = generateConversationSecret();
  saveConversationSecret(chatId, secret);
  return secret;
};

export const getConversationSecret = (chatId: string) => (
  chatId && activeAccountId ? secretCache.get(chatId) ?? null : null
);

export const hasConversationSecret = (chatId?: string | null) => (
  Boolean(chatId && getConversationSecret(chatId))
);

export const clearConversationSecret = (chatId: string) => {
  if (!chatId) return;
  secretCache.delete(chatId);

  if (activeAccountId && activeDeviceId && hasLocalStorage()) {
    window.localStorage.removeItem(getSecretStorageKey(activeAccountId, activeDeviceId, chatId));
  }
};

const isRecoveryKeyEnvelope = (value: unknown): value is RecoveryKeyEnvelope => {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as Partial<RecoveryKeyEnvelope>;

  return typeof envelope.version === 'number'
    && typeof envelope.chatId === 'string'
    && envelope.algorithm === ENCRYPTION_ALGORITHM
    && typeof envelope.keyVersion === 'number'
    && typeof envelope.keyBytes === 'number'
    && typeof envelope.secret === 'string';
};

export const exportConversationRecoveryKey = (chatId: string): ConversationRecoveryKeyExportResult => {
  const secret = getConversationSecret(chatId);

  if (!secret) return { ok: false, reason: 'missing-secret' };
  if (!isValidConversationSecret(secret)) return { ok: false, reason: 'invalid-secret' };

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

  if (!chatId || !normalizedRecoveryKey) return { ok: false, reason: 'empty' };
  if (!activeAccountId || !hasLocalStorage()) return { ok: false, reason: 'storage-unavailable' };
  if (!normalizedRecoveryKey.startsWith(RECOVERY_KEY_PREFIX)) return { ok: false, reason: 'format' };

  let envelope: unknown;
  try {
    envelope = decodeJsonFromBase64(normalizedRecoveryKey.slice(RECOVERY_KEY_PREFIX.length));
  } catch {
    return { ok: false, reason: 'format' };
  }

  if (!isRecoveryKeyEnvelope(envelope)) return { ok: false, reason: 'format' };
  if (
    envelope.version !== 1
    || envelope.keyVersion !== ENCRYPTION_KEY_VERSION
    || envelope.keyBytes !== AES_256_KEY_BYTES
  ) {
    return { ok: false, reason: 'version' };
  }
  if (envelope.chatId !== chatId) return { ok: false, reason: 'chat-mismatch' };
  if (!isValidConversationSecret(envelope.secret)) return { ok: false, reason: 'secret-invalid' };

  saveConversationSecret(chatId, envelope.secret);
  return { ok: true };
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

  await vaultReady;
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
    payload
    && typeof payload.ciphertext === 'string'
    && typeof payload.iv === 'string'
    && payload.algorithm === ENCRYPTION_ALGORITHM
    && Number(payload.keyVersion) === ENCRYPTION_KEY_VERSION
  )
);

export const decryptMessageText = async (
  chatId: string,
  payload?: EncryptedPayload | null
): Promise<EncryptedDecryptResult> => {
  if (!isValidEncryptedPayload(payload)) return { ok: false, reason: 'invalid-payload' };

  await vaultReady;
  const secret = getConversationSecret(chatId);
  if (!secret) return { ok: false, reason: 'missing-secret' };

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
