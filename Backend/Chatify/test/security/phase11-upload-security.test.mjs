import { describe, expect, it } from 'vitest';

import Attachment from '../../Models/attachmentModel.mjs';
import Message from '../../Models/messageModel.mjs';
import { getAttachmentBucket } from '../../Services/attachmentStorageService.mjs';
import {
  validateIncomingAttachments,
} from '../../Utils/attachmentValidation.mjs';
import {
  validateIncomingProfileImage,
} from '../../Utils/profileImageValidation.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import {
  tinyPdfBuffer,
  tinyTextBuffer,
} from '../fixtures/attachments.mjs';
import {
  attachProfileImage,
  tinyPngBuffer,
} from '../fixtures/profileImages.mjs';
import {
  getCsrfForAgent,
  signupWithAgent,
} from '../helpers/authAgent.mjs';

const makeUpload = ({ filename, contentType, buffer }) => ({
  originalname: filename,
  mimetype: contentType,
  buffer,
  size: buffer.length,
});

const activePdfBuffer = () => Buffer.from([
  '%PDF-1.7',
  '1 0 obj',
  '<< /Type /Catalog /OpenAction 2 0 R >>',
  'endobj',
  '2 0 obj',
  '<< /S /JavaScript /JS (app.alert(1)) >>',
  'endobj',
  'trailer << /Root 1 0 R >>',
  '%%EOF',
  '',
].join('\n'));

const pngWithOversizedDimensions = () => {
  const buffer = Buffer.from(tinyPngBuffer());
  buffer.writeUInt32BE(20_000, 16);
  buffer.writeUInt32BE(20_000, 20);
  return buffer;
};

const crc32 = (input) => {
  let crc = 0xffffffff;

  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const makePngChunk = (type, data) => {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
};

const pngWithPrivateMetadata = () => {
  const base = tinyPngBuffer();
  const iendOffset = base.lastIndexOf(Buffer.from('IEND', 'ascii')) - 4;
  const textChunk = makePngChunk(
    'tEXt',
    Buffer.from('Location\0ChatifyPrivateLocation', 'latin1')
  );

  return Buffer.concat([
    base.subarray(0, iendOffset),
    textChunk,
    base.subarray(iendOffset),
  ]);
};

const setupAttachmentScenario = async () => {
  await Promise.all([Attachment.init(), Message.init()]);

  const sender = await signupWithAgent({ firstName: 'Phase', lastName: 'ElevenSender' });
  const recipient = await signupWithAgent({ firstName: 'Phase', lastName: 'ElevenRecipient' });
  const chat = await createDirectChat([sender.user, recipient.user]);
  const response = await sender.agent
    .post('/api/message/new-message')
    .field('chatId', chat._id.toString())
    .field('text', 'Phase 11 attachment')
    .field('clientMessageId', `phase11-${Date.now()}-${Math.random()}`)
    .attach('attachments', tinyPdfBuffer(), {
      filename: 'phase-11.pdf',
      contentType: 'application/pdf',
    })
    .expect(201);
  const message = response.body.data.message;
  const storedAttachment = await Attachment.findOne({
    messageId: message._id,
  }).select('+hash');

  return {
    sender,
    recipient,
    chat,
    message,
    storedAttachment,
  };
};

describe('Phase 11 upload and attachment security', () => {
  it('rejects active PDF actions before persistence', async () => {
    const result = await validateIncomingAttachments([
      makeUpload({
        filename: 'active-document.pdf',
        contentType: 'application/pdf',
        buffer: activePdfBuffer(),
      }),
    ]);

    expect(result).toMatchObject({
      ok: false,
      code: 'ATTACHMENT_ACTIVE_CONTENT',
    });
  });

  it('rejects deceptive active-content inner extensions', async () => {
    const result = await validateIncomingAttachments([
      makeUpload({
        filename: 'invoice.html.txt',
        contentType: 'text/plain',
        buffer: tinyTextBuffer('<script>alert(1)</script>'),
      }),
    ]);

    expect(result).toMatchObject({
      ok: false,
      code: 'ATTACHMENT_FILENAME_DECEPTIVE',
    });
  });

  it('requires a real voice container signature instead of trusting the declared MIME type', async () => {
    const result = await validateIncomingAttachments([
      makeUpload({
        filename: 'voice-message.webm',
        contentType: 'audio/webm',
        buffer: tinyTextBuffer('not a webm container'),
      }),
    ], {
      metadata: [{ durationSeconds: 2 }],
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'ATTACHMENT_CONTAINER_INVALID',
    });
  });

  it('enforces a 20 MiB aggregate attachment limit', async () => {
    const sevenMiB = Buffer.alloc(7 * 1024 * 1024, 0x61);
    const files = [0, 1, 2].map((index) => makeUpload({
      filename: `large-${index}.txt`,
      contentType: 'text/plain',
      buffer: sevenMiB,
    }));

    const result = await validateIncomingAttachments(files);

    expect(result).toMatchObject({
      ok: false,
      code: 'ATTACHMENT_BATCH_SIZE_EXCEEDED',
    });
  });

  it('rejects image polyglots and oversized image dimensions for attachments', async () => {
    const polyglot = Buffer.concat([
      tinyPngBuffer(),
      Buffer.from('<html><script>alert(1)</script></html>'),
    ]);
    const polyglotResult = await validateIncomingAttachments([
      makeUpload({
        filename: 'polyglot.png',
        contentType: 'image/png',
        buffer: polyglot,
      }),
    ]);
    const dimensionsResult = await validateIncomingAttachments([
      makeUpload({
        filename: 'dimensions.png',
        contentType: 'image/png',
        buffer: pngWithOversizedDimensions(),
      }),
    ]);

    expect(polyglotResult).toMatchObject({
      ok: false,
      code: 'ATTACHMENT_POLYGLOT_REJECTED',
    });
    expect(dimensionsResult).toMatchObject({
      ok: false,
      code: 'ATTACHMENT_IMAGE_DIMENSIONS_EXCEEDED',
    });
  });

  it('applies the same polyglot and dimension controls to profile images', async () => {
    const polyglot = Buffer.concat([
      tinyPngBuffer(),
      Buffer.from('<svg onload=alert(1)>'),
    ]);
    const polyglotResult = await validateIncomingProfileImage(makeUpload({
      filename: 'profile.png',
      contentType: 'image/png',
      buffer: polyglot,
    }));
    const dimensionsResult = await validateIncomingProfileImage(makeUpload({
      filename: 'profile.png',
      contentType: 'image/png',
      buffer: pngWithOversizedDimensions(),
    }));

    expect(polyglotResult).toMatchObject({
      ok: false,
      code: 'PROFILE_IMAGE_POLYGLOT_REJECTED',
    });
    expect(dimensionsResult).toMatchObject({
      ok: false,
      code: 'PROFILE_IMAGE_DIMENSIONS_EXCEEDED',
    });
  });

  it('removes private image metadata before hashing and storage', async () => {
    const result = await validateIncomingProfileImage(makeUpload({
      filename: 'profile.png',
      contentType: 'image/png',
      buffer: pngWithPrivateMetadata(),
    }));

    expect(result.ok).toBe(true);
    expect(result.profileImage.metadataRemoved).toBe(true);
    expect(result.profileImage.buffer.includes(
      Buffer.from('ChatifyPrivateLocation', 'latin1')
    )).toBe(false);
    expect(result.profileImage.size).toBe(result.profileImage.buffer.length);
  });

  it('serves private files with nosniff, sandbox, same-origin, and frame-denial headers', async () => {
    const { recipient, storedAttachment } = await setupAttachmentScenario();

    const response = await recipient.agent
      .get(`/api/message/attachments/${storedAttachment._id}/preview`)
      .expect(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toMatch(/sandbox/i);
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['cache-control']).toMatch(/private/);
    expect(response.headers['cache-control']).toMatch(/no-store/);
  });

  it('purges GridFS content when a message is deleted for everyone', async () => {
    const { sender, message, storedAttachment } = await setupAttachmentScenario();
    const storageFileId = storedAttachment.storageFileId;

    await sender.agent
      .delete(`/api/message/${message._id}`)
      .send({ deleteForEveryone: true })
      .expect(200);

    const storedFiles = await getAttachmentBucket()
      .find({ _id: storageFileId })
      .toArray();
    const attachment = await Attachment.findById(storedAttachment._id);

    expect(storedFiles).toHaveLength(0);
    expect(attachment).toMatchObject({
      status: 'deleted',
      storageState: 'deleted',
    });
    expect(attachment.storageDeletedAt).toBeInstanceOf(Date);
  });

  it('purges messages, attachment metadata, and GridFS content when a chat is deleted', async () => {
    const { sender, chat, storedAttachment } = await setupAttachmentScenario();
    const storageFileId = storedAttachment.storageFileId;

    await sender.agent
      .delete(`/api/chat/${chat._id}`)
      .expect(200);

    expect(await Message.countDocuments({ chatId: chat._id })).toBe(0);
    expect(await Attachment.countDocuments({ chatId: chat._id })).toBe(0);
    expect(await getAttachmentBucket().find({ _id: storageFileId }).toArray()).toHaveLength(0);
  });

  it('hardens uploaded profile-image delivery headers', async () => {
    const user = await signupWithAgent({ firstName: 'Profile', lastName: 'Headers' });
    const csrfToken = await getCsrfForAgent(user.agent);
    const upload = await attachProfileImage(
      user.agent
        .patch('/api/user/profile-image')
        .set('X-CSRF-Token', csrfToken)
    ).expect(200);
    const response = await user.agent
      .get(upload.body.data.user.profilePic)
      .expect(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toMatch(/sandbox/i);
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['cache-control']).toMatch(/private/);
  });
});
