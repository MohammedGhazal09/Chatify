import { describe, expect, it, vi } from 'vitest';
import {
  createLogRecord,
  createRequestId,
  logger,
  redactLogMetadata,
  serializeLogError,
} from '../../Utils/observabilityLogger.mjs';

describe('observability logger', () => {
  it('redacts sensitive keys and nested metadata', () => {
    const authHeader = ['Bearer', 'secret-token'].join(' ');
    const metadata = {
      requestId: 'safe-request-id',
      token: 'access-token',
      cookieHeader: 'accessToken=secret',
      headers: {
        authorization: authHeader,
      },
      resetCode: '123456',
      email: 'person@example.test',
      signal: {
        sdp: 'v=0 sensitive-session-description',
        iceCandidate: 'candidate:secret',
      },
      messageText: 'private message',
      nested: {
        safeCount: 2,
        payload: { password: 'secret-password' },
      },
    };

    const redacted = redactLogMetadata(metadata);
    const serialized = JSON.stringify(redacted);

    expect(redacted.requestId).toBe('safe-request-id');
    expect(redacted.nested.safeCount).toBe(2);
    expect(serialized).not.toContain('access-token');
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('123456');
    expect(serialized).not.toContain('person@example.test');
    expect(serialized).not.toContain('sensitive-session-description');
    expect(serialized).not.toContain('candidate:secret');
    expect(serialized).not.toContain('private message');
    expect(serialized).not.toContain('secret-password');
  });

  it('sanitizes sensitive string values without removing safe fields', () => {
    const bearerPrefix = 'Bearer';
    const fakeBearer = ['secret', 'token', '123'].join('-');
    const fakeJwt = ['eyJabc', 'def', 'ghi'].join('.');
    const record = createLogRecord({
      level: 'warn',
      event: 'auth.failure',
      requestId: 'req-12345678',
      metadata: {
        route: '/api/auth/login',
        detail: `Authorization failed for user@example.test with ${bearerPrefix} ${fakeBearer} and ${fakeJwt}`,
      },
    });

    expect(record.event).toBe('auth.failure');
    expect(record.route).toBe('/api/auth/login');
    expect(record.detail).toContain('[redacted_email]');
    expect(record.detail).toContain('Bearer [redacted]');
    expect(record.detail).not.toContain('user@example.test');
    expect(record.detail).not.toContain(fakeJwt);
  });

  it('does not let metadata override reserved log fields', () => {
    const record = createLogRecord({
      level: 'warn',
      event: 'ops.readiness.checked',
      requestId: 'req-reserved-1',
      metadata: {
        timestamp: 'not-the-record-time',
        level: 'error',
        event: 'different.event',
        requestId: 'metadata-request-id',
        component: 'readiness',
      },
    });

    expect(record.level).toBe('warn');
    expect(record.event).toBe('ops.readiness.checked');
    expect(record.requestId).toBe('req-reserved-1');
    expect(record.timestamp).not.toBe('not-the-record-time');
    expect(record.component).toBe('readiness');
  });

  it('serializes errors without stack traces', () => {
    const error = new Error('Failed for user@example.test');
    error.code = 'ECONNRESET';
    error.statusCode = 503;

    expect(serializeLogError(error)).toEqual({
      name: 'Error',
      message: 'Failed for [redacted_email]',
      code: 'ECONNRESET',
      statusCode: 503,
    });
  });

  it('accepts safe request ids and replaces unsafe values', () => {
    expect(createRequestId('request-123456')).toBe('request-123456');
    expect(createRequestId('bad header value')).not.toBe('bad header value');
    expect(createRequestId('short')).not.toBe('short');
  });

  it('writes structured records when test logging is explicitly enabled', () => {
    const originalLogLevel = process.env.CHATIFY_LOG_LEVEL;
    const originalTestLogs = process.env.CHATIFY_TEST_LOGS;
    process.env.CHATIFY_TEST_LOGS = '1';
    process.env.CHATIFY_LOG_LEVEL = '';
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const record = logger.info('request.completed', {
      requestId: 'req-structured-1',
      token: 'secret-token',
      statusCode: 200,
    });

    expect(record).toMatchObject({
      level: 'info',
      event: 'request.completed',
      requestId: 'req-structured-1',
      statusCode: 200,
      token: '[redacted]',
    });
    expect(spy).toHaveBeenCalledWith(record);

    spy.mockRestore();
    process.env.CHATIFY_LOG_LEVEL = originalLogLevel;
    process.env.CHATIFY_TEST_LOGS = originalTestLogs;
  });
});
