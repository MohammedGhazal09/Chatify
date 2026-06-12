import { describe, expect, it, vi } from 'vitest';
import Attachment from '../../Models/attachmentModel.mjs';
import Message from '../../Models/messageModel.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import { attachPdf, attachText, tinyTextBuffer } from '../fixtures/attachments.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';
import { getAttachmentBucket } from '../../Services/attachmentStorageService.mjs';

const setupAttachmentScenario = async () => {
  await Message.init();
  await Attachment.init();

  const memberOne = await signupWithAgent({ firstName: 'Media', lastName: 'One' });
  const memberTwo = await signupWithAgent({ firstName: 'Media', lastName: 'Two' });
  const chat = await createDirectChat([memberOne.user, memberTwo.user]);

  return { memberOne, memberTwo, chat };
};

describe('message attachments', () => {
  it('serializes text-only messages with an empty attachments array', async () => {
    const { memberOne, chat } = await setupAttachmentScenario();

    const response = await memberOne.agent
      .post('/api/message/new-message')
      .send({
        chatId: chat._id.toString(),
        text: 'Text only still works',
        clientMessageId: 'text-only-attachment-contract',
      })
      .expect(201);

    expect(response.body.data.message).toMatchObject({
      text: 'Text only still works',
      attachments: [],
      pinned: false,
      pinnedBy: null,
      pinnedAt: null,
    });
  });

  it('creates attachment-only messages with safe summaries and private metadata', async () => {
    const { memberOne, chat } = await setupAttachmentScenario();

    const response = await attachPdf(
      memberOne.agent
        .post('/api/message/new-message')
        .field('chatId', chat._id.toString())
        .field('text', '')
        .field('clientMessageId', 'attachment-only-send')
    ).expect(201);
    const storedAttachment = await Attachment.findOne({ messageId: response.body.data.message._id })
      .select('+hash');

    expect(response.body.data.message.text).toBe('');
    expect(response.body.data.message.attachments).toHaveLength(1);
    expect(response.body.data.message.attachments[0]).toMatchObject({
      displayName: 'message-states-spec.pdf',
      mimeType: 'application/pdf',
      kind: 'file',
      status: 'active',
    });
    expect(response.body.data.message.attachments[0]).not.toHaveProperty('storageFileId');
    expect(response.body.data.message.attachments[0]).not.toHaveProperty('hash');
    expect(storedAttachment.storageFileId).toBeTruthy();
    expect(storedAttachment.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('preserves idempotency across matching attachment retries and rejects changed payloads', async () => {
    const { memberOne, chat } = await setupAttachmentScenario();
    const baseRequest = () => attachText(
      memberOne.agent
        .post('/api/message/new-message')
        .field('chatId', chat._id.toString())
        .field('text', 'Attach this')
        .field('clientMessageId', 'attachment-idempotency')
    );

    const firstResponse = await baseRequest().expect(201);
    const retryResponse = await baseRequest().expect(200);
    const conflictResponse = await attachText(
      memberOne.agent
        .post('/api/message/new-message')
        .field('chatId', chat._id.toString())
        .field('text', 'Attach this')
        .field('clientMessageId', 'attachment-idempotency'),
      'different-notes.txt',
      'different content'
    ).expect(409);

    expect(retryResponse.body.data.idempotent).toBe(true);
    expect(retryResponse.body.data.message._id).toBe(firstResponse.body.data.message._id);
    expect(conflictResponse.body.message).toMatch(/different message/i);
    await expect(Message.countDocuments({
      chatId: chat._id,
      sender: memberOne.user._id,
      clientMessageId: 'attachment-idempotency',
    })).resolves.toBe(1);
    await expect(Attachment.countDocuments({ chatId: chat._id })).resolves.toBe(1);
  });

  it('removes uploaded files when attachment metadata creation fails', async () => {
    const { memberOne, chat } = await setupAttachmentScenario();
    const createSpy = vi
      .spyOn(Attachment, 'create')
      .mockRejectedValueOnce(new Error('metadata write failed'));

    try {
      await attachText(
        memberOne.agent
          .post('/api/message/new-message')
          .field('chatId', chat._id.toString())
          .field('text', 'cleanup orphaned upload')
          .field('clientMessageId', 'attachment-metadata-failure'),
        'orphan-check.txt',
        'cleanup body'
      ).expect(500);
    } finally {
      createSpy.mockRestore();
    }

    const storedFiles = await getAttachmentBucket().find({ filename: 'orphan-check.txt' }).toArray();

    expect(storedFiles).toHaveLength(0);
    await expect(Attachment.countDocuments({ chatId: chat._id })).resolves.toBe(0);
    await expect(Message.countDocuments({ chatId: chat._id })).resolves.toBe(0);
  });

  it('rejects over-count, unsupported, and empty attachment payloads with stable codes', async () => {
    const { memberOne, chat } = await setupAttachmentScenario();
    let tooManyRequest = memberOne.agent
      .post('/api/message/new-message')
      .field('chatId', chat._id.toString())
      .field('text', 'too many');

    for (let index = 0; index < 6; index += 1) {
      tooManyRequest = tooManyRequest.attach('attachments', tinyTextBuffer(`file ${index}`), {
        filename: `file-${index}.txt`,
        contentType: 'text/plain',
      });
    }

    const tooMany = await tooManyRequest.expect(400);
    const unsupported = await memberOne.agent
      .post('/api/message/new-message')
      .field('chatId', chat._id.toString())
      .attach('attachments', tinyTextBuffer('nope'), {
        filename: 'payload.exe',
        contentType: 'application/octet-stream',
      })
      .expect(400);
    const empty = await memberOne.agent
      .post('/api/message/new-message')
      .field('chatId', chat._id.toString())
      .attach('attachments', Buffer.alloc(0), {
        filename: 'empty.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    expect(tooMany.body.code).toBe('ATTACHMENT_COUNT_EXCEEDED');
    expect(unsupported.body.code).toBe('ATTACHMENT_TYPE_UNSUPPORTED');
    expect(empty.body.code).toBe('ATTACHMENT_EMPTY');
  });
});
