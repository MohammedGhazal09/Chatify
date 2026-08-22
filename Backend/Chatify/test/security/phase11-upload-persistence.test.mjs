import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';

import Attachment from '../../Models/attachmentModel.mjs';
import Message from '../../Models/messageModel.mjs';
import { validateIncomingAttachments } from '../../Utils/attachmentValidation.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import {
  attachPdf,
  tinyDetectedWebmVoiceBuffer,
  tinyPdfBuffer,
  tinyTextBuffer,
} from '../fixtures/attachments.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const makeUpload = ({ filename, contentType, buffer }) => ({
  originalname: filename,
  mimetype: contentType,
  buffer,
  size: buffer.length,
});

describe('Phase 11 upload persistence boundary', () => {
  it('accepts structurally valid PDF, text, and WebM fixtures', async () => {
    const pdf = await validateIncomingAttachments([
      makeUpload({
        filename: 'safe.pdf',
        contentType: 'application/pdf',
        buffer: tinyPdfBuffer(),
      }),
    ]);
    const text = await validateIncomingAttachments([
      makeUpload({
        filename: 'safe.txt',
        contentType: 'text/plain',
        buffer: tinyTextBuffer('safe text'),
      }),
    ]);
    const voice = await validateIncomingAttachments([
      makeUpload({
        filename: 'safe.webm',
        contentType: 'audio/webm',
        buffer: tinyDetectedWebmVoiceBuffer(),
      }),
    ], {
      metadata: [{ durationSeconds: 2 }],
    });

    expect(pdf).toMatchObject({ ok: true });
    expect(text).toMatchObject({ ok: true });
    expect(voice).toMatchObject({ ok: true });
  });

  it('persists attachment metadata and its owning message under strict schemas', async () => {
    const chatId = new mongoose.Types.ObjectId();
    const messageId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const attachment = await Attachment.create({
      chatId,
      messageId,
      uploader: userId,
      storageFileId: new mongoose.Types.ObjectId(),
      displayName: 'safe.txt',
      originalExtension: 'txt',
      mimeType: 'text/plain',
      size: 9,
      kind: 'file',
      hash: 'a'.repeat(64),
      status: 'active',
    });
    const message = await Message.create({
      _id: messageId,
      chatId,
      sender: userId,
      clientMessageId: 'phase11-strict-persistence',
      text: '',
      status: 'sent',
      attachments: [{
        attachmentId: attachment._id,
        displayName: attachment.displayName,
        mimeType: attachment.mimeType,
        size: attachment.size,
        kind: attachment.kind,
        status: attachment.status,
        createdAt: attachment.createdAt,
      }],
      attachmentFingerprint: 'b'.repeat(64),
    });

    expect(attachment.storageState).toBe('active');
    expect(message.attachments).toHaveLength(1);
  });

  it('creates a safe attachment through the complete HTTP upload path', async () => {
    const sender = await signupWithAgent({ firstName: 'Phase', lastName: 'ElevenHttp' });
    const recipient = await signupWithAgent({ firstName: 'Phase', lastName: 'ElevenPeer' });
    const chat = await createDirectChat([sender.user, recipient.user]);
    const response = await attachPdf(
      sender.agent
        .post('/api/message/new-message')
        .field('chatId', chat._id.toString())
        .field('text', '')
        .field('clientMessageId', 'phase11-http-persistence')
    );

    if (response.status !== 201) {
      throw new Error(`Safe attachment upload failed with ${response.status}: ${JSON.stringify(response.body)}`);
    }

    expect(response.body.data.message.attachments).toHaveLength(1);
  });
});
