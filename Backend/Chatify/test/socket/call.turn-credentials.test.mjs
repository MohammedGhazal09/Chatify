import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getCallIceConfig } from '../../Utils/callIceConfig.mjs';

describe('TURN REST credentials', () => {
  it('mints short-lived per-call credentials without exposing the shared secret', () => {
    const env = {
      NODE_ENV: 'production',
      CALL_STUN_URLS: 'stun:stun.example.test:3478',
      CALL_TURN_URLS: 'turn:turn.example.test:3478?transport=udp',
      CALL_TURN_SHARED_SECRET: 'server-only-turn-shared-secret',
      CALL_TURN_CREDENTIAL_TTL_SECONDS: '600',
      CALL_TURN_USERNAME: 'legacy-static-user',
      CALL_TURN_CREDENTIAL: 'legacy-static-password',
    };
    const nowMs = Date.parse('2026-08-26T10:00:00.000Z');
    const first = getCallIceConfig(env, {
      userId: 'user-one',
      callId: 'call-one',
      nowMs,
    });
    const second = getCallIceConfig(env, {
      userId: 'user-two',
      callId: 'call-two',
      nowMs,
    });
    const firstTurn = first.iceServers.find((server) => String(server.urls).startsWith('turn:'));
    const secondTurn = second.iceServers.find((server) => String(server.urls).startsWith('turn:'));

    expect(first.turnReady).toBe(true);
    expect(firstTurn.username).toMatch(/^\d+:user-one:call-one$/);
    expect(firstTurn.username).not.toBe('legacy-static-user');
    expect(firstTurn.credential).not.toBe('legacy-static-password');
    expect(firstTurn.credential).not.toContain(env.CALL_TURN_SHARED_SECRET);
    expect(secondTurn.username).not.toBe(firstTurn.username);
    expect(secondTurn.credential).not.toBe(firstTurn.credential);
    expect(firstTurn.credential).toBe(
      createHmac('sha1', env.CALL_TURN_SHARED_SECRET)
        .update(firstTurn.username)
        .digest('base64')
    );
  });
});
