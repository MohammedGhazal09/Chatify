import { describe, expect, it, vi } from 'vitest';

import {
  createRestrictedLookup,
  isPublicIpAddress,
  normalizeOutboundHttpsUrl,
  OUTBOUND_URL_ERROR_CODES,
} from '../../Utils/outboundRequestSecurity.mjs';
import { normalizePushSubscriptionPayload } from '../../Utils/notificationPreferences.mjs';

const runLookup = (lookup, hostname, options = {}) => new Promise((resolve, reject) => {
  lookup(hostname, options, (error, address, family) => {
    if (error) {
      reject(error);
      return;
    }

    resolve({ address, family });
  });
});

const runAllLookup = (lookup, hostname) => new Promise((resolve, reject) => {
  lookup(hostname, { all: true }, (error, addresses) => {
    if (error) {
      reject(error);
      return;
    }

    resolve(addresses);
  });
});

describe('Phase 12 outbound request security', () => {
  it('classifies only globally routable IPv4 and IPv6 destinations as public', () => {
    expect(isPublicIpAddress('93.184.216.34')).toBe(true);
    expect(isPublicIpAddress('2606:2800:220:1:248:1893:25c8:1946')).toBe(true);

    for (const address of [
      '0.0.0.0',
      '10.0.0.1',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '192.168.0.1',
      '198.18.0.1',
      '224.0.0.1',
      '::',
      '::1',
      '::ffff:127.0.0.1',
      '64:ff9b::7f00:1',
      '2001:db8::1',
      '2002:7f00:1::',
      'fc00::1',
      'fe80::1',
      'ff02::1',
    ]) {
      expect(isPublicIpAddress(address), address).toBe(false);
    }
  });

  it('accepts only canonical HTTPS endpoints without credentials, fragments, or nonstandard ports', () => {
    expect(normalizeOutboundHttpsUrl('https://push.example.com/subscriptions/user-1?topic=chat'))
      .toMatchObject({
        ok: true,
        hostname: 'push.example.com',
        url: 'https://push.example.com/subscriptions/user-1?topic=chat',
      });

    const rejected = [
      'http://push.example.com/subscriptions/user-1',
      'https://user:password@push.example.com/subscriptions/user-1',
      'https://push.example.com:8443/subscriptions/user-1',
      'https://push.example.com/subscriptions/user-1#ignored-fragment',
      'https://localhost/subscriptions/user-1',
      'https://localhost./subscriptions/user-1',
      'https://127.0.0.1/subscriptions/user-1',
      'https://0x7f000001/subscriptions/user-1',
      'https://169.254.169.254/latest/meta-data',
      'https://10.0.0.1/subscriptions/user-1',
      'https://[::1]/subscriptions/user-1',
      'https://[fc00::1]/subscriptions/user-1',
    ];

    for (const endpoint of rejected) {
      expect(normalizeOutboundHttpsUrl(endpoint), endpoint).toMatchObject({ ok: false });
    }
  });

  it('rejects unsafe push endpoints before storing the subscription', () => {
    const result = normalizePushSubscriptionPayload({
      endpoint: 'https://169.254.169.254/latest/meta-data',
      keys: {
        p256dh: 'public-key-material',
        auth: 'auth-secret-material',
      },
    });

    expect(result).toMatchObject({
      ok: false,
      statusCode: 400,
    });
  });

  it('pins a public DNS result and rejects mixed public/private answers', async () => {
    const publicLookup = vi.fn((_hostname, options, callback) => {
      expect(options).toMatchObject({ all: true, verbatim: true });
      callback(null, [
        { address: '93.184.216.34', family: 4 },
        { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
      ]);
    });
    const restrictedPublicLookup = createRestrictedLookup({ lookup: publicLookup });

    await expect(runLookup(restrictedPublicLookup, 'push.example.com', { family: 4 }))
      .resolves.toEqual({ address: '93.184.216.34', family: 4 });
    await expect(runAllLookup(restrictedPublicLookup, 'push.example.com'))
      .resolves.toEqual([
        { address: '93.184.216.34', family: 4 },
        { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
      ]);

    const mixedLookup = vi.fn((_hostname, _options, callback) => callback(null, [
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]));
    const restrictedMixedLookup = createRestrictedLookup({ lookup: mixedLookup });

    await expect(runLookup(restrictedMixedLookup, 'rebind.example.com'))
      .rejects.toMatchObject({ code: OUTBOUND_URL_ERROR_CODES.ADDRESS_FORBIDDEN });
  });

  it('fails closed when DNS returns no usable address for the requested family', async () => {
    const ipv4OnlyLookup = vi.fn((_hostname, _options, callback) => callback(null, [
      { address: '93.184.216.34', family: 4 },
    ]));
    const restrictedLookup = createRestrictedLookup({ lookup: ipv4OnlyLookup });

    await expect(runLookup(restrictedLookup, 'push.example.com', { family: 6 }))
      .rejects.toMatchObject({ code: OUTBOUND_URL_ERROR_CODES.DNS_FAILED });
  });
});
