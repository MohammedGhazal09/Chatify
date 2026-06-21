import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearConversationSecret,
  decryptMessageText,
  encryptMessageText,
  ensureConversationSecret,
  generateConversationSecret,
  getConversationSecret,
  hasConversationSecret,
  isEncryptedConversation,
  isEncryptedMessage,
  saveConversationSecret,
} from './encryptedMessages';

describe('encrypted message helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('stores a local conversation secret and round-trips text through AES-GCM', async () => {
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

  it('normalizes encrypted chat and message detection', () => {
    expect(isEncryptedConversation({ encryptionMode: 'e2ee_v1' })).toBe(true);
    expect(isEncryptedConversation({ encryptionMode: 'standard' })).toBe(false);
    expect(isEncryptedMessage({ messageType: 'encrypted' })).toBe(true);
    expect(isEncryptedMessage({ messageType: 'text', encryptionMode: 'e2ee_v1' })).toBe(true);
  });
});
