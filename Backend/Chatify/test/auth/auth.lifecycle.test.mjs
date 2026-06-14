import request from 'supertest';
import { describe, expect, it } from 'vitest';
import jsonwebtoken from 'jsonwebtoken';
import { createHash, randomUUID } from 'crypto';
import { createUser, buildUserPayload, TEST_PASSWORD } from '../fixtures/users.mjs';
import { loginWithAgent, signupWithAgent } from '../helpers/authAgent.mjs';
import { getTestApp } from '../setup/app.mjs';
import OAuthHandoff from '../../Models/oauthHandoffModel.mjs';

const getAccessTokenCookie = (response) => {
  const cookies = response.headers['set-cookie'] ?? [];
  return cookies.find((cookie) => cookie.startsWith('accessToken='));
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
  it('sets an access token cookie on signup', async () => {
    const app = await getTestApp();
    const payload = buildUserPayload();

    const response = await request(app)
      .post('/api/auth/signup')
      .send(payload)
      .expect(201);

    const cookie = getAccessTokenCookie(response);
    expect(cookie).toBeTruthy();
    expect(cookie).toContain('HttpOnly');
    expect(response.body.success).toBe(true);
  });

  it('sets an access token cookie on login', async () => {
    const app = await getTestApp();
    const user = await createUser();

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(200);

    expect(getAccessTokenCookie(response)).toBeTruthy();
    expect(response.body.status).toBe('success');
  });

  it('reports authentication state from the preserved cookie', async () => {
    const { agent } = await signupWithAgent();

    const response = await agent.get('/api/auth/is-authenticated').expect(200);

    expect(response.body.token).toBe(true);
  });

  it('clears the access token cookie on logout', async () => {
    const { agent } = await signupWithAgent();

    const response = await agent.post('/api/auth/logout').expect(200);
    const cookie = getAccessTokenCookie(response);

    expect(cookie).toBeTruthy();
    expect(cookie).toContain('accessToken=');
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });

  it('uses a longer cookie max-age for remember-me logins', async () => {
    const user = await createUser();

    const normalLogin = await loginWithAgent({ email: user.email, rememberMe: false });
    const rememberLogin = await loginWithAgent({ email: user.email, rememberMe: true });

    const normalMaxAge = getCookieMaxAge(getAccessTokenCookie(normalLogin.response));
    const rememberMaxAge = getCookieMaxAge(getAccessTokenCookie(rememberLogin.response));

    expect(normalMaxAge).toBeGreaterThan(0);
    expect(rememberMaxAge).toBeGreaterThan(normalMaxAge);
  });

  it('rejects invalid credentials', async () => {
    const app = await getTestApp();
    const user = await createUser();

    const response = await request(app)
      .post('/api/auth/login')
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

  it('finalizes a valid OAuth handoff into an access token cookie', async () => {
    const app = await getTestApp();
    const { state, token } = await createOAuthHandoff();

    const response = await request(app)
      .get('/api/auth/oauth/finalize')
      .set('Cookie', [`chatify_oauth_state=${state}`])
      .query({ token })
      .expect(302);

    expect(response.headers.location).toBe('http://localhost:5173/?auth=success');
    expect(getAccessTokenCookie(response)).toBeTruthy();
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
});
