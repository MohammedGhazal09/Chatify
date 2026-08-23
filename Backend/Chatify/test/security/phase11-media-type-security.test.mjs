import { describe, expect, it } from 'vitest';

import {
  ATTACHMENT_ERROR_CODES,
  validateIncomingAttachments,
} from '../../Utils/attachmentValidation.mjs';

const FORGED_VOICE_CASES = [
  ['WebM', 'forged.webm', 'audio/webm'],
  ['Ogg', 'forged.ogg', 'audio/ogg'],
  ['Opus', 'forged.opus', 'audio/opus'],
];

describe('Phase 11 media type security', () => {
  it.each(FORGED_VOICE_CASES)(
    'rejects arbitrary bytes declared as an inline %s voice attachment',
    async (_label, originalname, mimetype) => {
      const buffer = Buffer.from('<html><script>globalThis.compromised=true</script></html>', 'utf8');

      await expect(validateIncomingAttachments([{
        originalname,
        mimetype,
        size: buffer.length,
        buffer,
      }], {
        metadata: [{ durationSeconds: 3 }],
      })).resolves.toMatchObject({
        ok: false,
        code: ATTACHMENT_ERROR_CODES.UNSUPPORTED_TYPE,
      });
    }
  );
});
