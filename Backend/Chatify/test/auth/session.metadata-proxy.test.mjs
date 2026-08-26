import { describe, expect, it } from 'vitest';
import {
  buildSessionMetadataFromRequest,
  hashSessionMetadataValue,
} from '../../Utils/sessionMetadata.mjs';

describe('session request metadata', () => {
  it('uses Express proxy resolution instead of the raw X-Forwarded-For header', () => {
    const metadata = buildSessionMetadataFromRequest({
      ip: '203.0.113.25',
      socket: { remoteAddress: '10.0.0.4' },
      headers: {
        'user-agent': 'Metadata Browser',
        'x-forwarded-for': '127.0.0.1, 10.0.0.4',
      },
    });

    expect(metadata.ipHash).toBe(hashSessionMetadataValue('203.0.113.25'));
    expect(metadata.ipHash).not.toBe(hashSessionMetadataValue('127.0.0.1'));
  });
});
