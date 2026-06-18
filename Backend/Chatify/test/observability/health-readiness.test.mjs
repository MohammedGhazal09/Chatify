import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { getTestApp } from '../setup/app.mjs';
import {
  buildReadinessPayload,
  getReadinessHttpStatus,
} from '../../Utils/operationalReadiness.mjs';

describe('operational health and readiness', () => {
  it('serves a cheap health endpoint', async () => {
    const app = await getTestApp();

    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'chatify-backend',
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  it('reports readiness components without secret values', async () => {
    const app = await getTestApp();

    const response = await request(app)
      .get('/api/ready')
      .expect(200);
    const serialized = JSON.stringify(response.body);

    expect(response.body.components).toEqual(expect.objectContaining({
      database: expect.any(Object),
      environment: expect.any(Object),
      storage: expect.any(Object),
      socket: expect.any(Object),
      cors: expect.any(Object),
      cookies: expect.any(Object),
      queues: expect.any(Object),
      calls: expect.any(Object),
    }));
    expect(response.body.components.environment.required).toContain('MONGODB_URL');
    expect(serialized).not.toContain(process.env.MONGODB_URL);
    expect(serialized).not.toContain(process.env.SECRET_JWT_KEY);
    expect(serialized).not.toContain(process.env.BREVO_API_KEY);
  });

  it('blocks production readiness when production env and TURN are missing', () => {
    const payload = buildReadinessPayload({
      env: {
        NODE_ENV: 'production',
        MONGODB_URL: 'mongodb://example.invalid/chatify',
        SECRET_JWT_KEY: 'jwt-secret',
        PASSWORD_RESET_SECRET: 'reset-secret',
        EMAIL_USER_SENDER: 'chatify@example.test',
        BREVO_API_KEY: 'brevo-secret',
        FRONTEND_ORIGIN: '',
        CALL_TURN_URLS: '',
        CALL_TURN_USERNAME: '',
        CALL_TURN_CREDENTIAL: '',
      },
      databaseReadyState: 1,
      socketStatus: {
        initialized: true,
        connectedUsers: 0,
        connectedSockets: 0,
        pendingCallTimeouts: 0,
        pendingCallDisconnectCleanups: 0,
      },
    });

    expect(payload.status).toBe('blocked');
    expect(payload.ready).toBe(false);
    expect(payload.components.environment.missing).toEqual(expect.arrayContaining([
      'FRONTEND_ORIGIN',
      'CALL_TURN_URLS',
      'CALL_TURN_USERNAME',
      'CALL_TURN_CREDENTIAL',
    ]));
    expect(payload.components.calls.status).toBe('blocked');
    expect(getReadinessHttpStatus(payload)).toBe(503);
    expect(JSON.stringify(payload)).not.toContain('jwt-secret');
    expect(JSON.stringify(payload)).not.toContain('brevo-secret');
  });

  it('uses the provided env when evaluating production TURN readiness', () => {
    const payload = buildReadinessPayload({
      env: {
        NODE_ENV: 'production',
        MONGODB_URL: 'mongodb://example.invalid/chatify',
        SECRET_JWT_KEY: 'jwt-secret',
        PASSWORD_RESET_SECRET: 'reset-secret',
        EMAIL_USER_SENDER: 'chatify@example.test',
        BREVO_API_KEY: 'brevo-secret',
        FRONTEND_ORIGIN: 'https://chatify.example.test',
        CALL_TURN_URLS: 'turn:turn.example.test:3478',
        CALL_TURN_USERNAME: 'turn-user',
        CALL_TURN_CREDENTIAL: 'turn-secret',
      },
      databaseReadyState: 1,
      socketStatus: {
        initialized: true,
        connectedUsers: 0,
        connectedSockets: 0,
        pendingCallTimeouts: 0,
        pendingCallDisconnectCleanups: 0,
      },
    });

    expect(payload.status).toBe('ok');
    expect(payload.ready).toBe(true);
    expect(payload.components.environment.missing).toEqual([]);
    expect(payload.components.calls.status).toBe('ok');
    expect(payload.components.calls.turnReady).toBe(true);
    expect(payload.components.calls.productionReady).toBe(true);
    expect(getReadinessHttpStatus(payload)).toBe(200);
    expect(JSON.stringify(payload)).not.toContain('turn-secret');
  });
});
