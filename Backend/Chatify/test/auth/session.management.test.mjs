import request from 'supertest';
import { describe, expect, it } from 'vitest';
import Session from '../../Models/sessionModel.mjs';
import { buildUserPayload, createUser, TEST_PASSWORD } from '../fixtures/users.mjs';
import { getCsrfForAgent, loginWithAgent, signupWithAgent } from '../helpers/authAgent.mjs';
import { getTestApp } from '../setup/app.mjs';

const WINDOWS_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36';

const getSessionCookie = (response, name) => {
  const cookies = response.headers['set-cookie'] ?? [];
  return cookies.find((cookie) => cookie.startsWith(`${name}=`));
};

describe('session management', () => {
  it('lists active sessions with safe metadata and current-session state', async () => {
    const app = await getTestApp();
    const agent = request.agent(app);
    const payload = buildUserPayload();
    const csrfToken = await getCsrfForAgent(agent);

    await agent
      .post('/api/auth/signup')
      .set('X-CSRF-Token', csrfToken)
      .set('User-Agent', WINDOWS_CHROME_UA)
      .send(payload)
      .expect(201);

    const response = await agent
      .get('/api/auth/sessions')
      .expect(200);

    expect(response.body.data.sessions).toHaveLength(1);
    expect(response.body.data.sessions[0]).toMatchObject({
      current: true,
      deviceLabel: 'Chrome on Windows',
      rememberMe: false,
      id: expect.any(String),
      createdAt: expect.any(String),
      lastUsedAt: expect.any(String),
      expiresAt: expect.any(String),
    });
    expect(JSON.stringify(response.body)).not.toContain('refreshTokenHash');
    expect(JSON.stringify(response.body)).not.toContain('userAgentHash');
    expect(JSON.stringify(response.body)).not.toContain('ipHash');
    expect(JSON.stringify(response.body)).not.toContain(WINDOWS_CHROME_UA);
    expect(JSON.stringify(response.body)).not.toContain(payload.email);
  });

  it('revokes a non-current session and blocks its protected HTTP access', async () => {
    const user = await createUser();
    const firstLogin = await loginWithAgent({ email: user.email, password: TEST_PASSWORD });
    const secondLogin = await loginWithAgent({ email: user.email, password: TEST_PASSWORD });
    const firstCsrfToken = await getCsrfForAgent(firstLogin.agent);

    const sessionsResponse = await firstLogin.agent
      .get('/api/auth/sessions')
      .expect(200);
    const targetSession = sessionsResponse.body.data.sessions.find((session) => session.current === false);

    expect(targetSession).toBeTruthy();

    await firstLogin.agent
      .delete(`/api/auth/sessions/${targetSession.id}`)
      .set('X-CSRF-Token', firstCsrfToken)
      .expect(200);

    await secondLogin.agent
      .get('/api/auth/sessions')
      .expect(401);

    const revokedSession = await Session.findById(targetSession.id);
    expect(revokedSession.revokedAt).toBeInstanceOf(Date);
  });

  it('rejects row-level current-session revocation and supports logout everywhere', async () => {
    const { agent } = await signupWithAgent();
    const csrfToken = await getCsrfForAgent(agent);
    const sessionsResponse = await agent
      .get('/api/auth/sessions')
      .expect(200);
    const currentSession = sessionsResponse.body.data.sessions.find((session) => session.current === true);

    await agent
      .delete(`/api/auth/sessions/${currentSession.id}`)
      .set('X-CSRF-Token', csrfToken)
      .expect(400);

    const revokeAllResponse = await agent
      .post('/api/auth/sessions/revoke-all')
      .set('X-CSRF-Token', csrfToken)
      .expect(200);

    expect(revokeAllResponse.body.data.revokedCount).toBeGreaterThanOrEqual(1);
    expect(getSessionCookie(revokeAllResponse, 'accessToken')).toContain('Expires=Thu, 01 Jan 1970');
    expect(getSessionCookie(revokeAllResponse, 'refreshToken')).toContain('Expires=Thu, 01 Jan 1970');

    const authState = await agent
      .get('/api/auth/is-authenticated')
      .expect(200);

    expect(authState.body.token).toBe(false);
  });
});
