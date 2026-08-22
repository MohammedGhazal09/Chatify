import { describe, expect, it } from 'vitest';

import {
  ATTACHMENT_ERROR_CODES,
  validateIncomingAttachments,
} from '../../Utils/attachmentValidation.mjs';

describe('Phase 11 media type security', () => {
  it('rejects arbitrary bytes declared as an inline WebM voice attachment', async () => {
    const buffer = Buffer.from('<html><script>globalThis.compromised=true</script></html>', 'utf8');

    await expect(validateIncomingAttachments([{
      originalname: 'forged.webm',
      mimetype: 'audio/webm',
      size: buffer.length,
      buffer,
    }], {
      metadata: [{ durationSeconds: 3 }],
    })).resolves.toMatchObject({
      ok: false,
      code: ATTACHMENT_ERROR_CODES.UNSUPPORTED_TYPE,
    });
  });
});
