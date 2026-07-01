import { describe, expect, it } from 'vitest';
import Attachment from '../../Models/attachmentModel.mjs';
import Chats from '../../Models/chatModel.mjs';
import Message from '../../Models/messageModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { attachText } from '../fixtures/attachments.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const encryptedPayload = (overrides = {}) => ({
  ciphertext: 'base64-ciphertext-envelope',
  iv: 'base64-iv',
  authTag: 'base64-auth-tag',
  algorithm: 'AES-GCM',
  keyVersion: 1,
  senderDeviceId: 'device-member-one',
  encryptedAt: '2026-06-20T00:00:00.000Z',
  ...overrides,
});

const setupEncryptedMessageScenario = async () => {
  await Chats.init();
  await Message.init();

  const memberOne = await signupWithAgent({ firstName: 'Encrypted', lastName: 'Sender' });
  const memberTwo = await signupWithAgent({ firstName: 'Encrypted', lastName: 'Recipient' });
  const outsider = await signupWithAgent({ firstName: 'Encrypted', lastName: 'Outsider' });
  const chat = await createDirectChat([memberOne.user, memberTwo.user], {
    encryptionMode: 'e2ee_v1',
  });

  return { memberOne, memberTwo, outsider, chat };
};

const sendEncryptedMessage = (agent, chatId, payload = {}) => agent
  .post('/api/message/new-message')
  .send({
    chatId: chatId.toString(),
    text: '',
    clientMessageId: 'encrypted-client-message-1',
    encryptedPayload: encryptedPayload(),
    ...payload,
  });

describe('encrypted message HTTP contract', () => {
  it('stores encrypted envelopes without plaintext and returns them in history', async () => {
    const { memberOne, memberTwo, chat } = await setupEncryptedMessageScenario();
    const payload = encryptedPayload({
      ciphertext: 'ciphertext-without-private-marker',
      attachmentManifest: { items: [] },
    });

    const response = await sendEncryptedMessage(memberOne.agent, chat._id, {
      clientMessageId: 'encrypted-store-1',
      encryptedPayload: payload,
    }).expect(201);
    const message = response.body.data.message;
    const storedMessage = await Message.findById(message._id).select('+encryptedPayloadFingerprint').lean();
    const history = await memberTwo.agent
      .get(`/api/message/get-all-messages/${chat._id}`)
      .expect(200);

    expect(message).toMatchObject({
      chatId: chat._id.toString(),
      sender: memberOne.user._id.toString(),
      text: '',
      messageType: 'encrypted',
      encryptionMode: 'e2ee_v1',
      encryptedPayload: {
        ciphertext: payload.ciphertext,
        iv: payload.iv,
        authTag: payload.authTag,
        algorithm: 'AES-GCM',
        keyVersion: 1,
        senderDeviceId: payload.senderDeviceId,
        encryptedAt: payload.encryptedAt,
      },
    });
    expect(storedMessage.text).toBe('');
    expect(storedMessage.encryptedPayloadFingerprint).toEqual(expect.any(String));
    expect(JSON.stringify(storedMessage)).not.toContain('PRIVATE_TEXT_MARKER');
    expect(history.body.data.messages).toHaveLength(1);
    expect(history.body.data.messages[0]).toMatchObject({
      _id: message._id,
      text: '',
      messageType: 'encrypted',
      encryptionMode: 'e2ee_v1',
      encryptedPayload: expect.objectContaining({
        ciphertext: payload.ciphertext,
      }),
    });
  });

  it('rejects plaintext and file uploads in encrypted conversations', async () => {
    const { memberOne, chat } = await setupEncryptedMessageScenario();

    const plaintextResponse = await sendEncryptedMessage(memberOne.agent, chat._id, {
      clientMessageId: 'encrypted-plaintext-rejected',
      text: 'PRIVATE_TEXT_MARKER',
    }).expect(400);
    const attachmentResponse = await attachText(
      memberOne.agent
        .post('/api/message/new-message')
        .field('chatId', chat._id.toString())
        .field('text', '')
        .field('clientMessageId', 'encrypted-attachment-rejected')
        .field('encryptedPayload', JSON.stringify(encryptedPayload())),
      'secret-plan.txt',
      'PRIVATE_FILE_MARKER'
    ).expect(400);

    expect(plaintextResponse.body.code).toBe('encrypted_plaintext_rejected');
    expect(attachmentResponse.body.code).toBe('encrypted_attachments_unavailable');
    await expect(Message.countDocuments({ chatId: chat._id })).resolves.toBe(0);
    await expect(Attachment.countDocuments({ chatId: chat._id })).resolves.toBe(0);
  });

  it('keeps encrypted clientMessageId retries idempotent and rejects changed envelopes', async () => {
    const { memberOne, chat } = await setupEncryptedMessageScenario();
    const basePayload = {
      chatId: chat._id.toString(),
      text: '',
      clientMessageId: 'encrypted-idempotent-1',
      encryptedPayload: encryptedPayload({
        ciphertext: 'stable-ciphertext',
      }),
    };

    const first = await memberOne.agent
      .post('/api/message/new-message')
      .send(basePayload)
      .expect(201);
    const retry = await memberOne.agent
      .post('/api/message/new-message')
      .send(basePayload)
      .expect(200);
    const conflict = await memberOne.agent
      .post('/api/message/new-message')
      .send({
        ...basePayload,
        encryptedPayload: encryptedPayload({
          ciphertext: 'changed-ciphertext',
        }),
      })
      .expect(409);

    expect(retry.body.data.idempotent).toBe(true);
    expect(retry.body.data.message._id).toBe(first.body.data.message._id);
    expect(conflict.body.message).toMatch(/different encrypted payload/i);
    await expect(Message.countDocuments({
      chatId: chat._id,
      sender: memberOne.user._id,
      clientMessageId: basePayload.clientMessageId,
    })).resolves.toBe(1);
  });

  it('rejects malformed encrypted payloads without creating a message', async () => {
    const { memberOne, chat } = await setupEncryptedMessageScenario();

    const missingPayload = await sendEncryptedMessage(memberOne.agent, chat._id, {
      clientMessageId: 'encrypted-missing-payload',
      encryptedPayload: undefined,
    }).expect(400);
    const unsupportedAlgorithm = await sendEncryptedMessage(memberOne.agent, chat._id, {
      clientMessageId: 'encrypted-bad-algorithm',
      encryptedPayload: encryptedPayload({ algorithm: 'AES-CBC' }),
    }).expect(400);

    expect(missingPayload.body.code).toBe('encrypted_payload_invalid');
    expect(unsupportedAlgorithm.body.message).toMatch(/algorithm is unsupported/i);
    await expect(Message.countDocuments({ chatId: chat._id })).resolves.toBe(0);
  });

  it('returns explicit limits for search and editing encrypted messages', async () => {
    const { memberOne, chat } = await setupEncryptedMessageScenario();

    const created = await sendEncryptedMessage(memberOne.agent, chat._id, {
      clientMessageId: 'encrypted-limited-actions',
    }).expect(201);
    const search = await memberOne.agent
      .get(`/api/message/search/${chat._id}?q=alpha`)
      .expect(400);
    const edit = await memberOne.agent
      .patch(`/api/message/${created.body.data.message._id}/edit`)
      .send({ text: 'New plaintext' })
      .expect(400);

    expect(search.body.code).toBe('encrypted_search_unavailable');
    expect(edit.body.code).toBe('encrypted_edit_unavailable');
  });
});
