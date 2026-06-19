import request from 'supertest';
import { describe, expect, it } from 'vitest';
import jsonwebtoken from 'jsonwebtoken';
import { createHash, randomUUID } from 'crypto';
import { createUser, buildUserPayload, TEST_PASSWORD } from '../fixtures/users.mjs';
import { getCsrfForAgent, loginWithAgent, signupWithAgent } from '../helpers/authAgent.mjs';
import { getTestApp } from '../setup/app.mjs';
import OAuthHandoff from '../../Models/oauthHandoffModel.mjs';
import Session from '../../Models/sessionModel.mjs';
import User from '../../Models/userModel.mjs';

const getAccessTokenCookie = (response) => {
  const cookies = response.headers['set-cookie'] ?? [];
  return cookies.find((cookie) => cookie.startsWith('accessToken='));
};

const getRefreshTokenCookie = (response) => {
  const cookies = response.headers['set-cookie'] ?? [];
  return cookies.find((cookie) => cookie.startsWith('refreshToken='));
};

const getCookieMaxAge = (cookie) => {
  const match = cookie?.match(/Max-Age=(\d+)/i);
  return match ? Number(match[1]) : 0;
};

const getNamedCookie = (response, name) => {
  const cookies = response.headers['set-cookie'] ?? [];
  return cookies.find((cookie) => cookie.startsWith(`${name}=`));
};

const getCookieValue = (cookie) => cookie?.split(';')[0]?.split('=').slice(1).join('=');

const hashOAuthState = (state) => createHash('sha256').update(state).digest('base64url');

const createOAuthHandoff = async ({ user, state = 'oauth-state' } = {}) => {
  const targetUser = user ?? await createUser();
  const stateHash = hashOAuthState(state);
  const jti = randomUUID();

  await OAuthHandoff.create({
    jti,
    userId: targetUser._id,
    stateHash,
    expiresAt: new Date(Date.now() + 60 * 1000),
  });

  const token = jsonwebtoken.sign(
    {
      userId: targetUser._id,
      type: 'oauth_handoff',
      purpose: 'oauth_handoff',
      jti,
      stateHash,
    },
    process.env.SECRET_JWT_KEY,
    { expiresIn: '60s' }
  );

  return { state, targetUser, token };
};

describe('auth lifecycle routes', () => {
  it('sets access and refresh token cookies on signup', async () => {
    const app = await getTestApp();
    const agent = request.agent(app);
    const payload = buildUserPayload();
    const csrfToken = await getCsrfForAgent(agent);

    const response = await agent
      .post('/api/auth/signup')
      .set('X-CSRF-Token', csrfToken)
      .send(payload)
      .expect(201);

    const accessCookie = getAccessTokenCookie(response);
    const refreshCookie = getRefreshTokenCookie(response);
    expect(accessCookie).toBeTruthy();
    expect(refreshCookie).toBeTruthy();
    expect(accessCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('HttpOnly');
    expect(response.body.success).toBe(true);
  });

  it('sets access and refresh token cookies on login', async () => {
    const app = await getTestApp();
    const agent = request.agent(app);
    const user = await createUser();
    const csrfToken = await getCsrfForAgent(agent);

    const response = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfToken)
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(200);

    expect(getAccessTokenCookie(response)).toBeTruthy();
    expect(getRefreshTokenCookie(response)).toBeTruthy();
    expect(response.body.status).toBe('success');
  });

  it('reports authentication state from the preserved cookie', async () => {
    const { agent } = await signupWithAgent();

    const response = await agent.get('/api/auth/is-authenticated').expect(200);

    expect(response.body.token).toBe(true);
  });

  it('clears the access token cookie on logout', async () => {
    const { agent } = await signupWithAgent();
    const csrfToken = await getCsrfForAgent(agent);

    const response = await agent
      .post('/api/auth/logout')
      .set('X-CSRF-Token', csrfToken)
      .expect(200);
    const accessCookie = getAccessTokenCookie(response);
    const refreshCookie = getRefreshTokenCookie(response);

    expect(accessCookie).toBeTruthy();
    expect(refreshCookie).toBeTruthy();
    expect(accessCookie).toContain('accessToken=');
    expect(refreshCookie).toContain('refreshToken=');
    expect(accessCookie).toMatch(/Expires=Thu, 01 Jan 1970/i);
    expect(refreshCookie).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });

  it('uses a longer refresh cookie max-age for remember-me logins', async () => {
    const user = await createUser();

    const normalLogin = await loginWithAgent({ email: user.email, rememberMe: false });
    const rememberLogin = await loginWithAgent({ email: user.email, rememberMe: true });

    const normalMaxAge = getCookieMaxAge(getRefreshTokenCookie(normalLogin.response));
    const rememberMaxAge = getCookieMaxAge(getRefreshTokenCookie(rememberLogin.response));

    expect(normalMaxAge).toBeGreaterThan(0);
    expect(rememberMaxAge).toBeGreaterThan(normalMaxAge);
  });

  it('rotates refresh tokens and rejects replayed refresh cookies', async () => {
    const app = await getTestApp();
    const { agent, response } = await signupWithAgent();
    const oldRefreshCookie = getRefreshTokenCookie(response)?.split(';')[0];
    const csrfToken = await getCsrfForAgent(agent);

    const refreshResponse = await agent
      .post('/api/auth/refresh-token')
      .set('X-CSRF-Token', csrfToken)
      .expect(200);

    expect(getAccessTokenCookie(refreshResponse)).toBeTruthy();
    expect(getRefreshTokenCookie(refreshResponse)).toBeTruthy();
    expect(getRefreshTokenCookie(refreshResponse)?.split(';')[0]).not.toBe(oldRefreshCookie);
    expect(await Session.countDocuments({ revokedAt: { $ne: null } })).toBe(1);

    const replayAgent = request.agent(app);
    const replayCsrf = await getCsrfForAgent(replayAgent);
    await replayAgent
      .post('/api/auth/refresh-token')
      .set('Cookie', `${oldRefreshCookie}; XSRF-TOKEN=${encodeURIComponent(replayCsrf)}`)
      .set('X-CSRF-Token', replayCsrf)
      .expect(401);
  });

  it('rejects invalid credentials', async () => {
    const app = await getTestApp();
    const user = await createUser();
    const agent = request.agent(app);
    const csrfToken = await getCsrfForAgent(agent);

    const response = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfToken)
      .send({ email: user.email, password: 'WrongPassword123!' });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(getAccessTokenCookie(response)).toBeUndefined();
  });

  it('sets a first-party OAuth state cookie on provider login start', async () => {
    const app = await getTestApp();

    const response = await request(app)
      .get('/api/auth/google')
      .expect(302);

    const redirectUrl = new URL(response.headers.location);
    const state = redirectUrl.searchParams.get('state');
    const stateCookie = getNamedCookie(response, 'chatify_oauth_state');

    expect(redirectUrl.hostname).toBe('accounts.google.com');
    expect(state).toBeTruthy();
    expect(getCookieValue(stateCookie)).toBe(state);
    expect(stateCookie).toContain('HttpOnly');
    expect(stateCookie).toContain('Path=/api/auth');
    expect(stateCookie).toMatch(/SameSite=Lax/i);
  });

  it('finalizes a valid OAuth handoff into access and refresh token cookies', async () => {
    const app = await getTestApp();
    const { state, token } = await createOAuthHandoff();

    const response = await request(app)
      .get('/api/auth/oauth/finalize')
      .set('Cookie', [`chatify_oauth_state=${state}`])
      .query({ token })
      .expect(302);

    expect(response.headers.location).toBe('http://localhost:5173/?auth=success');
    expect(getAccessTokenCookie(response)).toBeTruthy();
    expect(getRefreshTokenCookie(response)).toBeTruthy();
    expect(getNamedCookie(response, 'chatify_oauth_state')).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });

  it('rejects invalid OAuth handoff tokens without setting a cookie', async () => {
    const app = await getTestApp();

    const response = await request(app)
      .get('/api/auth/oauth/finalize')
      .query({ token: 'invalid-token' })
      .expect(302);

    expect(response.headers.location).toBe('http://localhost:5173/login?error=auth_failed');
    expect(getAccessTokenCookie(response)).toBeUndefined();
  });

  it('rejects OAuth handoff tokens without the matching state cookie', async () => {
    const app = await getTestApp();
    const { token } = await createOAuthHandoff({ state: 'expected-state' });

    const response = await request(app)
      .get('/api/auth/oauth/finalize')
      .set('Cookie', ['chatify_oauth_state=wrong-state'])
      .query({ token })
      .expect(302);

    expect(response.headers.location).toBe('http://localhost:5173/login?error=auth_failed');
    expect(getAccessTokenCookie(response)).toBeUndefined();
  });

  it('rejects replayed OAuth handoff tokens after first use', async () => {
    const app = await getTestApp();
    const { state, token } = await createOAuthHandoff();

    await request(app)
      .get('/api/auth/oauth/finalize')
      .set('Cookie', [`chatify_oauth_state=${state}`])
      .query({ token })
      .expect(302);

    const replayResponse = await request(app)
      .get('/api/auth/oauth/finalize')
      .set('Cookie', [`chatify_oauth_state=${state}`])
      .query({ token })
      .expect(302);

    expect(replayResponse.headers.location).toBe('http://localhost:5173/login?error=auth_failed');
    expect(getAccessTokenCookie(replayResponse)).toBeUndefined();
  });

  it('does not accept OAuth handoff tokens as access tokens', async () => {
    const app = await getTestApp();
    const { token } = await createOAuthHandoff();

    const response = await request(app)
      .get('/api/user/get-logged-user')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(response.body.message).toMatch(/invalid token|token verification failed/i);
  });

  it('uses one generic response for missing, wrong-password, and OAuth login failures', async () => {
    const app = await getTestApp();
    const localUser = await createUser({ firstName: 'Uniform', lastName: 'Local' });
    const oauthUser = await User.create({
      firstName: 'Uniform',
      lastName: 'OAuth',
      email: 'uniform-oauth@example.test',
      authProvider: 'google',
      googleId: 'google-uniform-user',
      isVerified: true,
    });
    const agent = request.agent(app);
    const csrfToken = await getCsrfForAgent(agent);

    const cases = [
      { email: 'missing-login@example.test', password: TEST_PASSWORD },
      { email: localUser.email, password: 'WrongPassword123!' },
      { email: oauthUser.email, password: TEST_PASSWORD },
    ];
    const responses = [];

    for (const body of cases) {
      const response = await agent
        .post('/api/auth/login')
        .set('X-CSRF-Token', csrfToken)
        .send(body)
        .expect(401);

      responses.push(response);
    }

    expect(new Set(responses.map((response) => response.body.message)).size).toBe(1);
    responses.forEach((response) => {
      expect(getAccessTokenCookie(response)).toBeUndefined();
      expect(response.body.message).toBe('Email or password is incorrect');
    });
  });
});
