import { randomUUID } from 'node:crypto';
import request from 'supertest';
import jsonwebtoken from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { handleOAuthUser } from '../../Config/passport.mjs';
import Session from '../../Models/sessionModel.mjs';
import User from '../../Models/userModel.mjs';
import { buildUserPayload, createUser, TEST_PASSWORD } from '../fixtures/users.mjs';
import { getCsrfForAgent, signupWithAgent } from '../helpers/authAgent.mjs';
import { getTestApp } from '../setup/app.mjs';

const cookiePair = (response, name) => {
  const cookie = (response.headers['set-cookie'] ?? [])
    .find((entry) => entry.startsWith(`${name}=`));
  return cookie?.split(';')[0] ?? null;
};

const cookieValue = (response, name) => {
  const pair = cookiePair(response, name);
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
};

const buildAccessToken = ({ userId, sessionId, issuer = 'chatify-api', audience = 'chatify-web' }) => (
  jsonwebtoken.sign(
    {
      userId: userId.toString(),
      type: 'access',
      jti: randomUUID(),
      ...(sessionId ? { sessionId: sessionId.toString() } : {}),
    },
    process.env.SECRET_JWT_KEY,
    {
      algorithm: 'HS256',
      expiresIn: '15m',
      subject: userId.toString(),
      issuer,
      audience,
    },
  )
);

describe('Phase 5 authentication and session invariants', () => {
  it('rejects a correctly signed access token that has no server-side session claim', async () => {
    const app = await getTestApp();
    const user = await createUser();
    const token = buildAccessToken({ userId: user._id });

    await request(app)
      .get('/api/user/get-logged-user')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rejects an access token with the wrong issuer even when the session is active', async () => {
    const app = await getTestApp();
    const { user } = await signupWithAgent();
    const session = await Session.findOne({ userId: user._id, revokedAt: null });
    const token = buildAccessToken({
      userId: user._id,
      sessionId: session._id,
      issuer: 'attacker-controlled-issuer',
    });

    await request(app)
      .get('/api/user/get-logged-user')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('canonicalizes padded mixed-case email for signup and login', async () => {
    const app = await getTestApp();
    const signupAgent = request.agent(app);
    const signupCsrf = await getCsrfForAgent(signupAgent);
    const canonicalEmail = 'phase5.identity@example.test';
    const payload = buildUserPayload({ email: '  Phase5.Identity@Example.TEST  ' });

    await signupAgent
      .post('/api/auth/signup')
      .set('X-CSRF-Token', signupCsrf)
      .send(payload)
      .expect(201);

    const stored = await User.findOne({ email: canonicalEmail });
    expect(stored).toBeTruthy();

    const loginAgent = request.agent(app);
    const loginCsrf = await getCsrfForAgent(loginAgent);
    await loginAgent
      .post('/api/auth/login')
      .set('X-CSRF-Token', loginCsrf)
      .send({ email: canonicalEmail.toUpperCase(), password: payload.password })
      .expect(200);
  });

  it('preserves leading and trailing password spaces and rejects short passwords', async () => {
    const app = await getTestApp();
    const password = '  correct horse battery staple  ';
    const payload = buildUserPayload({ password });
    const signupAgent = request.agent(app);
    const signupCsrf = await getCsrfForAgent(signupAgent);

    await signupAgent
      .post('/api/auth/signup')
      .set('X-CSRF-Token', signupCsrf)
      .send(payload)
      .expect(201);

    const loginAgent = request.agent(app);
    const loginCsrf = await getCsrfForAgent(loginAgent);
    await loginAgent
      .post('/api/auth/login')
      .set('X-CSRF-Token', loginCsrf)
      .send({ email: payload.email, password })
      .expect(200);

    const shortAgent = request.agent(app);
    const shortCsrf = await getCsrfForAgent(shortAgent);
    const shortResponse = await shortAgent
      .post('/api/auth/signup')
      .set('X-CSRF-Token', shortCsrf)
      .send(buildUserPayload({ password: 'Short123!' }));

    expect(shortResponse.statusCode).toBeGreaterThanOrEqual(400);
    expect(shortResponse.statusCode).toBeLessThan(500);
    expect(cookiePair(shortResponse, 'accessToken')).toBeNull();
  });

  it('rejects OAuth identities whose provider email is not verified', async () => {
    const profile = {
      id: 'phase5-unverified-google-user',
      name: { givenName: 'Unverified', familyName: 'User' },
      emails: [{ value: 'unverified.oauth@example.test', verified: false }],
      photos: [],
      _json: { email_verified: false },
    };

    await expect(handleOAuthUser(profile, 'google'))
      .rejects
      .toThrow(/verified email/i);

    expect(await User.countDocuments()).toBe(0);
  });

  it('revokes the access-token session on logout even when the refresh cookie is absent', async () => {
    const app = await getTestApp();
    const { response } = await signupWithAgent({}, { autoCsrf: false });
    const accessCookie = cookiePair(response, 'accessToken');
    const csrfResponse = await request(app).get('/api/csrf-token').expect(204);
    const csrfCookie = cookiePair(csrfResponse, 'XSRF-TOKEN');
    const csrfToken = cookieValue(csrfResponse, 'XSRF-TOKEN');

    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `${accessCookie}; ${csrfCookie}`)
      .set('X-CSRF-Token', csrfToken)
      .expect(200);

    await request(app)
      .get('/api/user/get-logged-user')
      .set('Cookie', accessCookie)
      .expect(401);
  });

  it('keeps the established valid credential path working', async () => {
    const app = await getTestApp();
    const user = await createUser();
    const agent = request.agent(app);
    const csrfToken = await getCsrfForAgent(agent);

    await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfToken)
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(200);
  });
});
