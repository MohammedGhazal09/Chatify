import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createUser, buildUserPayload, TEST_PASSWORD } from '../fixtures/users.mjs';
import { loginWithAgent, signupWithAgent } from '../helpers/authAgent.mjs';
import { getTestApp } from '../setup/app.mjs';

const getAccessTokenCookie = (response) => {
  const cookies = response.headers['set-cookie'] ?? [];
  return cookies.find((cookie) => cookie.startsWith('accessToken='));
};

const getCookieMaxAge = (cookie) => {
  const match = cookie?.match(/Max-Age=(\d+)/i);
  return match ? Number(match[1]) : 0;
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
});
