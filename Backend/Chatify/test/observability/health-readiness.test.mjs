import request from 'supertest';
import { describe, expect, it } from 'vitest';
import User from '../../Models/userModel.mjs';
import { signupWithAgent } from '../helpers/authAgent.mjs';
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

  it('exposes only minimal readiness state to unauthenticated callers', async () => {
    const app = await getTestApp();

    const response = await request(app)
      .get('/api/ready')
      .expect(200);
    const serialized = JSON.stringify(response.body);

    expect(response.body).toMatchObject({
      service: 'chatify-backend',
      ready: expect.any(Boolean),
      status: expect.any(String),
      timestamp: expect.any(String),
    });
    expect(Object.keys(response.body).sort()).toEqual([
      'ready',
      'service',
      'status',
      'timestamp',
    ]);
    expect(response.body).not.toHaveProperty('components');
    expect(serialized).not.toContain('MONGODB_URL');
    expect(serialized).not.toContain('SECRET_JWT_KEY');
    expect(serialized).not.toContain('BREVO_API_KEY');
  });

  it('restricts queue diagnostics to authenticated administrators', async () => {
    const app = await getTestApp();
    const regular = await signupWithAgent({ firstName: 'Queue', lastName: 'User' });
    const admin = await signupWithAgent({ firstName: 'Queue', lastName: 'Admin' });
    await User.findByIdAndUpdate(admin.user._id, { role: 'admin' });

    await request(app).get('/api/queue-status').expect(401);
    await regular.agent.get('/api/queue-status').expect(403);

    const response = await admin.agent.get('/api/queue-status').expect(200);
    expect(response.body).toMatchObject({
      database: expect.any(Object),
      email: expect.any(Object),
      heavy: expect.any(Object),
    });
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
        CALL_TURN_USEBNAME: '',
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
      'CALL_TURN_USEBNAME',
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
        CALL_TURN_USEBNAME: 'turn-user',
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
