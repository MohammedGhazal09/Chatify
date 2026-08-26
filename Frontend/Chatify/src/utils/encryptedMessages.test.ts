import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearConversationSecret,
  decryptMessageText,
  encryptMessageText,
  ensureConversationSecret,
  exportConversationRecoveryKey,
  generateConversationSecret,
  getConversationSecret,
  hasConversationSecret,
  importConversationRecoveryKey,
  isEncryptedConversation,
  isEncryptedMessage,
  lockConversationKeyVault,
  saveConversationSecret,
  setConversationKeyAccount,
} from './encryptedMessages';

describe('encrypted message helpers', () => {
  beforeEach(async () => {
    lockConversationKeyVault();
    window.localStorage.clear();
    await setConversationKeyAccount('account-a');
  });

  it('stores an account-scoped conversation secret and round-trips text through AES-GCM', async () => {
    const secret = ensureConversationSecret('chat-1');
    const payload = await encryptMessageText({
      chatId: 'chat-1',
      text: 'PRIVATE_TEXT_MARKER',
      encryptionMode: 'e2ee_v1',
    });
    const decrypted = await decryptMessageText('chat-1', payload);

    expect(secret).toEqual(expect.any(String));
    expect(getConversationSecret('chat-1')).toBe(secret);
    expect(hasConversationSecret('chat-1')).toBe(true);
    expect(payload).toMatchObject({
      algorithm: 'AES-GCM',
      keyVersion: 1,
      senderDeviceId: expect.any(String),
      ciphertext: expect.any(String),
      iv: expect.any(String),
    });
    expect(payload.ciphertext).not.toContain('PRIVATE_TEXT_MARKER');
    expect(decrypted).toEqual({ ok: true, text: 'PRIVATE_TEXT_MARKER' });
    expect([...Array(window.localStorage.length)].map((_, index) => (
      window.localStorage.getItem(window.localStorage.key(index) ?? '')
    ))).not.toContain(secret);
  });

  it('reports missing and invalid local secrets without exposing ciphertext', async () => {
    ensureConversationSecret('chat-1');
    const payload = await encryptMessageText({
      chatId: 'chat-1',
      text: 'Cannot read elsewhere',
      encryptionMode: 'e2ee_v1',
    });

    clearConversationSecret('chat-1');
    await expect(decryptMessageText('chat-1', payload)).resolves.toEqual({
      ok: false,
      reason: 'missing-secret',
    });

    saveConversationSecret('chat-1', generateConversationSecret());
    await expect(decryptMessageText('chat-1', payload)).resolves.toEqual({
      ok: false,
      reason: 'decrypt-failed',
    });
  });

  it('locks cached secrets and prevents cross-account inheritance', async () => {
    const firstAccountSecret = ensureConversationSecret('shared-chat-id');

    await setConversationKeyAccount('account-b');
    expect(hasConversationSecret('shared-chat-id')).toBe(false);
    expect(getConversationSecret('shared-chat-id')).toBeNull();

    ensureConversationSecret('shared-chat-id');
    lockConversationKeyVault();

    expect(getConversationSecret('shared-chat-id')).toBeNull();
    expect(firstAccountSecret).toEqual(expect.any(String));
  });

  it('removes legacy plaintext secret entries when a vault account is activated', async () => {
    lockConversationKeyVault();
    window.localStorage.setItem(
      'chatify:e2ee:v1:conversation-secret:legacy-chat',
      generateConversationSecret()
    );

    await setConversationKeyAccount('account-a');

    expect(window.localStorage.getItem(
      'chatify:e2ee:v1:conversation-secret:legacy-chat'
    )).toBeNull();
  });

  it('normalizes encrypted chat and message detection', () => {
    expect(isEncryptedConversation({ encryptionMode: 'e2ee_v1' })).toBe(true);
    expect(isEncryptedConversation({ encryptionMode: 'standard' })).toBe(false);
    expect(isEncryptedMessage({ messageType: 'encrypted' })).toBe(true);
    expect(isEncryptedMessage({ messageType: 'text', encryptionMode: 'e2ee_v1' })).toBe(true);
  });

  it('exports and imports a chat-bound recovery key without changing the encrypted payload', async () => {
    const secret = ensureConversationSecret('chat-1');
    const payload = await encryptMessageText({
      chatId: 'chat-1',
      text: 'Recoverable encrypted text',
      encryptionMode: 'e2ee_v1',
    });
    const exported = exportConversationRecoveryKey('chat-1');

    expect(exported).toEqual({
      ok: true,
      recoveryKey: expect.stringMatching(/^chatify-e2ee-v1:/),
    });

    clearConversationSecret('chat-1');
    expect(hasConversationSecret('chat-1')).toBe(false);

    const importResult = exported.ok
      ? importConversationRecoveryKey('chat-1', `  ${exported.recoveryKey}  `)
      : { ok: false };

    expect(importResult).toEqual({ ok: true });
    expect(getConversationSecret('chat-1')).toBe(secret);
    await expect(decryptMessageText('chat-1', payload)).resolves.toEqual({
      ok: true,
      text: 'Recoverable encrypted text',
    });
  });

  it('returns explicit recovery export and import failures', () => {
    expect(exportConversationRecoveryKey('chat-1')).toEqual({
      ok: false,
      reason: 'missing-secret',
    });

    expect(importConversationRecoveryKey('chat-1', '')).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(importConversationRecoveryKey('chat-1', 'chatify-e2ee-v1:not-json')).toEqual({
      ok: false,
      reason: 'format',
    });
    expect(importConversationRecoveryKey('chat-1', 'wrong-prefix')).toEqual({
      ok: false,
      reason: 'format',
    });
  });

  it('fails closed for wrong-chat recovery keys and preserves the current secret', () => {
    const originalSecret = ensureConversationSecret('chat-1');
    const otherSecret = ensureConversationSecret('chat-2');
    const exported = exportConversationRecoveryKey('chat-2');

    expect(exported.ok).toBe(true);

    const importResult = exported.ok
      ? importConversationRecoveryKey('chat-1', exported.recoveryKey)
      : { ok: false };

    expect(importResult).toEqual({
      ok: false,
      reason: 'chat-mismatch',
    });
    expect(getConversationSecret('chat-1')).toBe(originalSecret);
    expect(getConversationSecret('chat-2')).toBe(otherSecret);
  });
});
