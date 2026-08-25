import { describe, expect, it } from 'vitest';

import { validateAndSanitizeUploadContent } from '../../Utils/uploadContentSecurity.mjs';
import { tinyWebpBuffer } from '../fixtures/profileImages.mjs';

describe('Phase 11 image container security', () => {
  it('rejects a WebP container whose RIFF length extends beyond the received bytes', async () => {
    const truncated = Buffer.from(tinyWebpBuffer());
    truncated.writeUInt32LE(truncated.length + 128, 4);

    await expect(validateAndSanitizeUploadContent({
      buffer: truncated,
      mimeType: 'image/webp',
      extension: 'webp',
      purpose: 'profile-image',
    })).resolves.toMatchObject({
      ok: false,
      code: 'UPLOAD_IMAGE_MALFORMED',
    });
  });
});
