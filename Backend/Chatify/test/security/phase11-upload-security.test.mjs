import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';

import Attachment from '../../Models/attachmentModel.mjs';
import Chats from '../../Models/chatModel.mjs';
import UploadBudget from '../../Models/uploadBudgetModel.mjs';
import User from '../../Models/userModel.mjs';
import {
  getAttachmentBucket,
  uploadAttachmentBuffer,
} from '../../Services/attachmentStorageService.mjs';
import {
  getProfileImageBucket,
  uploadProfileImageBuffer,
} from '../../Services/profileImageStorageService.mjs';
import {
  reconcileUploadStorage,
} from '../../Services/uploadLifecycleService.mjs';
import {
  UploadBudgetExceededError,
  reserveUploadBudget,
} from '../../Services/uploadBudgetService.mjs';
import {
  buildSecureUploadHeaders,
  validateAndSanitizeUploadContent,
} from '../../Utils/uploadContentSecurity.mjs';
import {
  ATTACHMENT_ERROR_CODES,
  MAX_ATTACHMENT_AGGREGATE_SIZE_BYTES,
  validateAggregateUploadSize,
} from '../../Utils/attachmentValidation.mjs';
import { createDirectChat } from '../fixtures/chats.mjs';
import {
  attachPdf,
  attachText,
  tinyPdfBuffer,
  tinyTextBuffer,
} from '../fixtures/attachments.mjs';
import {
  tinyJpegBuffer,
  tinyPngBuffer,
} from '../fixtures/profileImages.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';

const collectStream = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
};

const makePngChunk = (type, data) => {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, typeBuffer, data, Buffer.alloc(4)]);
};

const addPngTextMetadata = (buffer, text = 'GPS=51.5007,-0.1246') => {
  const iendOffset = buffer.lastIndexOf(Buffer.from('IEND', 'ascii')) - 4;
  return Buffer.concat([
    buffer.subarray(0, iendOffset),
    makePngChunk('tEXt', Buffer.from(`Comment\0${text}`, 'latin1')),
    buffer.subarray(iendOffset),
  ]);
};

const addJpegExifMetadata = (buffer) => {
  const payload = Buffer.from('Exif\0\0GPSLatitude=51.5007;GPSLongitude=-0.1246', 'latin1');
  const length = Buffer.alloc(2);
  length.writeUInt16BE(payload.length + 2, 0);
  return Buffer.concat([
    buffer.subarray(0, 2),
    Buffer.from([0xff, 0xe1]),
    length,
    payload,
    buffer.subarray(2),
  ]);
};

const makeOversizedPng = () => {
  const buffer = Buffer.from(tinyPngBuffer());
  buffer.writeUInt32BE(50_000, 16);
  buffer.writeUInt32BE(50_000, 20);
  return buffer;
};

const phase11Limits = Object.freeze({
  maxBytes: 10,
  maxFiles: 2,
  maxRequests: 2,
});

describe('Phase 11 upload and attachment security', () => {
  it('rejects active-content PDFs, image polyglots, and macro-enabled office payloads', async () => {
    const activePdf = Buffer.concat([
      tinyPdfBuffer(),
      Buffer.from('\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >> endobj'),
    ]);
    const imagePolyglot = Buffer.concat([
      tinyPngBuffer(),
      Buffer.from('<script>globalThis.compromised=true</script>', 'utf8'),
    ]);
    const macroDocument = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('word/vbaProject.bin\0word/embeddings/oleObject1.bin', 'utf8'),
    ]);

    await expect(validateAndSanitizeUploadContent({
      buffer: activePdf,
      mimeType: 'application/pdf',
      extension: 'pdf',
      purpose: 'attachment',
    })).resolves.toMatchObject({
      ok: false,
      code: 'UPLOAD_ACTIVE_CONTENT_REJECTED',
    });

    await expect(validateAndSanitizeUploadContent({
      buffer: imagePolyglot,
      mimeType: 'image/png',
      extension: 'png',
      purpose: 'attachment',
    })).resolves.toMatchObject({
      ok: false,
      code: 'UPLOAD_POLYGLOT_REJECTED',
    });

    await expect(validateAndSanitizeUploadContent({
      buffer: macroDocument,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
      purpose: 'attachment',
    })).resolves.toMatchObject({
      ok: false,
      code: 'UPLOAD_ACTIVE_CONTENT_REJECTED',
    });
  });

  it('strips privacy-sensitive PNG and JPEG metadata before storage', async () => {
    const png = await validateAndSanitizeUploadContent({
      buffer: addPngTextMetadata(tinyPngBuffer()),
      mimeType: 'image/png',
      extension: 'png',
      purpose: 'profile-image',
    });
    const jpeg = await validateAndSanitizeUploadContent({
      buffer: addJpegExifMetadata(tinyJpegBuffer()),
      mimeType: 'image/jpeg',
      extension: 'jpg',
      purpose: 'profile-image',
    });

    expect(png).toMatchObject({
      ok: true,
      metadataStripped: true,
      dimensions: { width: 1, height: 1 },
    });
    expect(jpeg).toMatchObject({
      ok: true,
      metadataStripped: true,
      dimensions: { width: 1, height: 1 },
    });
    expect(png.buffer.toString('latin1')).not.toContain('GPS=');
    expect(jpeg.buffer.toString('latin1')).not.toContain('GPSLatitude');
  });

  it('rejects compressed image dimension bombs before storage', async () => {
    await expect(validateAndSanitizeUploadContent({
      buffer: makeOversizedPng(),
      mimeType: 'image/png',
      extension: 'png',
      purpose: 'profile-image',
    })).resolves.toMatchObject({
      ok: false,
      code: 'UPLOAD_IMAGE_DIMENSIONS_EXCEEDED',
    });
  });

  it('enforces an aggregate attachment limit in addition to per-file limits', () => {
    expect(MAX_ATTACHMENT_AGGREGATE_SIZE_BYTES).toBeGreaterThan(10 * 1024 * 1024);
    expect(validateAggregateUploadSize([
      { size: MAX_ATTACHMENT_AGGREGATE_SIZE_BYTES - 1 },
      { size: 1 },
    ])).toMatchObject({ ok: true });
    expect(validateAggregateUploadSize([
      { size: MAX_ATTACHMENT_AGGREGATE_SIZE_BYTES },
      { size: 1 },
    ])).toMatchObject({
      ok: false,
      code: ATTACHMENT_ERROR_CODES.AGGREGATE_SIZE_EXCEEDED,
    });
  });

  it('atomically rejects upload-budget races that would exceed a user daily quota', async () => {
    const userId = new mongoose.Types.ObjectId();
    const now = new Date('2026-08-22T12:00:00.000Z');

    const attempts = await Promise.allSettled([
      reserveUploadBudget({
        userId,
        purpose: 'attachment',
        bytes: 6,
        files: 1,
        now,
        limits: phase11Limits,
      }),
      reserveUploadBudget({
        userId,
        purpose: 'attachment',
        bytes: 6,
        files: 1,
        now,
        limits: phase11Limits,
      }),
    ]);
    const fulfilled = attempts.filter((attempt) => attempt.status === 'fulfilled');
    const rejected = attempts.filter((attempt) => attempt.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(UploadBudgetExceededError);
    expect(await UploadBudget.countDocuments({ userId })).toBe(1);
    expect((await UploadBudget.findOne({ userId })).bytes).toBe(6);
  });

  it('builds no-sniff, no-store, sandboxed delivery headers and forces risky previews to download', () => {
    const imageHeaders = buildSecureUploadHeaders({
      mimeType: 'image/png',
      displayName: 'avatar.png',
      mode: 'preview',
    });
    const textHeaders = buildSecureUploadHeaders({
      mimeType: 'text/plain',
      displayName: 'report\r\nX-Injected: yes.txt',
      mode: 'preview',
    });

    expect(imageHeaders).toMatchObject({
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    });
    expect(imageHeaders['Content-Disposition']).toMatch(/^inline;/);
    expect(textHeaders['Content-Disposition']).toMatch(/^attachment;/);
    expect(textHeaders['Content-Disposition']).not.toMatch(/[\r\n]/);
  });

  it('keeps multipart message creation working and serves text attachments as protected downloads', async () => {
    const memberOne = await signupWithAgent({ firstName: 'Phase11', lastName: 'Uploader' });
    const memberTwo = await signupWithAgent({ firstName: 'Phase11', lastName: 'Viewer' });
    const chat = await createDirectChat([memberOne.user, memberTwo.user]);

    const created = await attachText(
      memberOne.agent
        .post('/api/message/new-message')
        .field('chatId', chat._id.toString())
        .field('text', 'Phase 11 protected attachment')
        .field('clientMessageId', 'phase11-multipart-regression'),
      'phase11-notes.txt',
      'safe notes'
    ).expect(201);
    const attachmentId = created.body.data.message.attachments[0].attachmentId;

    const preview = await memberTwo.agent
      .get(`/api/message/attachments/${attachmentId}/preview`)
      .expect(200);

    expect(preview.headers['content-disposition']).toMatch(/^attachment;/);
    expect(preview.headers['x-content-type-options']).toBe('nosniff');
    expect(preview.headers['content-security-policy']).toBe("sandbox; default-src 'none'");
    expect(preview.headers['cache-control']).toBe('private, no-store');

    await Chats.updateOne(
      { _id: chat._id },
      { $pull: { members: memberTwo.user._id } }
    );

    await memberTwo.agent
      .get(`/api/message/attachments/${attachmentId}/preview`)
      .expect(404);
  });

  it('rejects active-content attachment uploads through the HTTP boundary with a stable code', async () => {
    const memberOne = await signupWithAgent({ firstName: 'Phase11', lastName: 'Pdf' });
    const memberTwo = await signupWithAgent({ firstName: 'Phase11', lastName: 'Peer' });
    const chat = await createDirectChat([memberOne.user, memberTwo.user]);
    const activePdf = Buffer.concat([
      tinyPdfBuffer(),
      Buffer.from('\n/OpenAction /JavaScript /JS (app.alert(1))', 'utf8'),
    ]);

    const response = await memberOne.agent
      .post('/api/message/new-message')
      .field('chatId', chat._id.toString())
      .field('text', '')
      .field('clientMessageId', 'phase11-active-pdf')
      .attach('attachments', activePdf, {
        filename: 'active.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    expect(response.body.code).toBe('ATTACHMENT_ACTIVE_CONTENT_REJECTED');
    expect(await Attachment.countDocuments({ chatId: chat._id })).toBe(0);
  });

  it('removes stale orphaned GridFS objects without exposing stored metadata', async () => {
    const now = new Date();
    const attachmentStorageId = await uploadAttachmentBuffer({
      buffer: tinyTextBuffer('orphan attachment'),
      filename: 'orphan.txt',
      contentType: 'text/plain',
      metadata: { privateValue: 'must-never-enter-evidence' },
    });
    const profileStorageId = await uploadProfileImageBuffer({
      buffer: tinyPngBuffer(),
      filename: 'orphan.png',
      contentType: 'image/png',
      metadata: { privateValue: 'must-never-enter-evidence' },
    });

    const result = await reconcileUploadStorage({
      now: new Date(now.getTime() + 1_000),
      orphanGraceMs: 0,
    });

    expect(result).toEqual(expect.objectContaining({
      attachmentOrphansDeleted: 1,
      profileImageOrphansDeleted: 1,
      errors: 0,
    }));
    expect(JSON.stringify(result)).not.toContain('privateValue');
    expect(await getAttachmentBucket().find({ _id: attachmentStorageId }).toArray()).toHaveLength(0);
    expect(await getProfileImageBucket().find({ _id: profileStorageId }).toArray()).toHaveLength(0);
  });

  it('stores sanitized profile-image bytes and sends browser-isolation headers', async () => {
    const owner = await signupWithAgent({ firstName: 'Phase11', lastName: 'Profile' });
    const pngWithMetadata = addPngTextMetadata(tinyPngBuffer(), 'GPS=secret-location');

    const uploaded = await owner.agent
      .patch('/api/user/profile-image')
      .attach('profileImage', pngWithMetadata, {
        filename: 'profile.png',
        contentType: 'image/png',
      })
      .expect(200);
    const storedUser = await User.findById(owner.user._id).select('+uploadedProfileImage');
    const storedBytes = await collectStream(
      getProfileImageBucket().openDownloadStream(storedUser.uploadedProfileImage.storageFileId)
    );

    expect(storedBytes.toString('latin1')).not.toContain('secret-location');

    const response = await owner.agent
      .get(uploaded.body.data.user.profilePic)
      .expect(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
  });
});
