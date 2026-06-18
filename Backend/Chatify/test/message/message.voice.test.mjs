import { describe, expect, it } from 'vitest';
import Attachment from '../../Models/attachmentModel.mjs';
import Message from '../../Models/messageModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { attachVoice, tinyVoiceBuffer } from '../fixtures/attachments.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const setupVoiceScenario = async () => {
  await Message.init();
  await Attachment.init();

  const memberOne = await signupWithAgent({ firstName: 'Voice', lastName: 'One' });
  const memberTwo = await signupWithAgent({ firstName: 'Voice', lastName: 'Two' });
  const outsider = await signupWithAgent({ firstName: 'Voice', lastName: 'Outsider' });
  const chat = await createDirectChat([memberOne.user, memberTwo.user]);

  return { memberOne, memberTwo, outsider, chat };
};

describe('voice message attachments', () => {
  it('creates voice-only messages with duration metadata and private storage fields', async () => {
    const { memberOne, chat } = await setupVoiceScenario();

    const response = await attachVoice(
      memberOne.agent
        .post('/api/message/new-message')
        .field('chatId', chat._id.toString())
        .field('text', '')
        .field('clientMessageId', 'voice-only-send'),
      { durationSeconds: 7.25 }
    ).expect(201);
    const message = response.body.data.message;
    const storedAttachment = await Attachment.findOne({ messageId: message._id }).select('+hash');

    expect(message.text).toBe('');
    expect(message.attachments).toHaveLength(1);
    expect(message.attachments[0]).toMatchObject({
      displayName: 'voice-message.webm',
      mimeType: 'audio/webm',
      kind: 'voice',
      durationSeconds: 7.25,
      status: 'active',
    });
    expect(message.attachments[0]).not.toHaveProperty('storageFileId');
    expect(message.attachments[0]).not.toHaveProperty('hash');
    expect(storedAttachment).toMatchObject({
      kind: 'voice',
      durationSeconds: 7.25,
      mimeType: 'audio/webm',
    });
    expect(storedAttachment.storageFileId).toBeTruthy();
    expect(storedAttachment.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('preserves idempotency for matching voice retries and rejects changed voice metadata', async () => {
    const { memberOne, chat } = await setupVoiceScenario();
    const baseRequest = (durationSeconds = 4) => attachVoice(
      memberOne.agent
        .post('/api/message/new-message')
        .field('chatId', chat._id.toString())
        .field('text', 'Listen to this')
        .field('clientMessageId', 'voice-idempotency'),
      { durationSeconds, text: 'same voice bytes' }
    );

    const firstResponse = await baseRequest().expect(201);
    const retryResponse = await baseRequest().expect(200);
    const conflictResponse = await baseRequest(5).expect(409);

    expect(retryResponse.body.data.idempotent).toBe(true);
    expect(retryResponse.body.data.message._id).toBe(firstResponse.body.data.message._id);
    expect(conflictResponse.body.message).toMatch(/different message/i);
    await expect(Message.countDocuments({
      chatId: chat._id,
      sender: memberOne.user._id,
      clientMessageId: 'voice-idempotency',
    })).resolves.toBe(1);
    await expect(Attachment.countDocuments({ chatId: chat._id, kind: 'voice' })).resolves.toBe(1);
  });

  it('protects voice preview and shared asset listing with the existing member boundary', async () => {
    const { memberOne, memberTwo, outsider, chat } = await setupVoiceScenario();
    const response = await attachVoice(
      memberOne.agent
        .post('/api/message/new-message')
        .field('chatId', chat._id.toString())
        .field('text', '')
        .field('clientMessageId', 'voice-access')
    ).expect(201);
    const attachmentId = response.body.data.message.attachments[0].attachmentId;

    const preview = await memberTwo.agent
      .get(`/api/message/attachments/${attachmentId}/preview`)
      .expect(200);
    const sharedAssets = await memberTwo.agent
      .get(`/api/message/${chat._id}/shared-assets?kind=voice`)
      .expect(200);
    const outsiderPreview = await outsider.agent
      .get(`/api/message/attachments/${attachmentId}/preview`)
      .expect(404);

    expect(preview.headers['content-type']).toMatch(/audio\/webm/);
    expect(sharedAssets.body.data.assets[0]).toMatchObject({
      attachmentId,
      kind: 'voice',
      durationSeconds: 2.5,
    });
    expect(outsiderPreview.body.message).toMatch(/attachment not found/i);
  });

  it('rejects missing, too-short, too-long, and unsupported voice payloads with stable codes', async () => {
    const { memberOne, chat } = await setupVoiceScenario();
    const baseRequest = (clientMessageId) => memberOne.agent
      .post('/api/message/new-message')
      .field('chatId', chat._id.toString())
      .field('text', '')
      .field('clientMessageId', clientMessageId);

    const missingDuration = await baseRequest('voice-missing-duration')
      .attach('attachments', tinyVoiceBuffer(), {
        filename: 'missing-duration.webm',
        contentType: 'audio/webm',
      })
      .expect(400);
    const tooShort = await attachVoice(baseRequest('voice-too-short'), {
      durationSeconds: 0.5,
      filename: 'too-short.webm',
    }).expect(400);
    const tooLong = await attachVoice(baseRequest('voice-too-long'), {
      durationSeconds: 121,
      filename: 'too-long.webm',
    }).expect(400);
    const unsupported = await attachVoice(baseRequest('voice-unsupported'), {
      durationSeconds: 3,
      filename: 'voice.wav',
      contentType: 'audio/wav',
    }).expect(400);

    expect(missingDuration.body.code).toBe('VOICE_DURATION_INVALID');
    expect(tooShort.body.code).toBe('VOICE_DURATION_INVALID');
    expect(tooLong.body.code).toBe('VOICE_DURATION_EXCEEDED');
    expect(unsupported.body.code).toBe('ATTACHMENT_TYPE_UNSUPPORTED');
  });
});
