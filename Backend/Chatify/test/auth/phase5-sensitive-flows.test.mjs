import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import jsonwebtoken from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import OAuthHandoff from '../../Models/oauthHandoffModel.mjs';
import PasswordReset from '../../Models/passwordResetModel.mjs';
import User from '../../Models/userModel.mjs';
import { generateTotpCode } from '../../Utils/twoFactor.mjs';
import { createUser, TEST_PASSWORD } from '../fixtures/users.mjs';
import { getCsrfForAgent, loginWithAgent, signupWithAgent } from '../helpers/authAgent.mjs';
import { getTestApp } from '../setup/app.mjs';

const hash = (value) => createHash('sha256').update(value).digest('base64url');
const hashResetCode = (value) => createHmac('sha256', process.env.PASSWORD_RESET_SECRET)
  .update(String(value))
  .digest('base64url');

const setupAndConfirmTwoFactor = async (agent, csrfToken) => {
  const setupResponse = await agent
    .post('/api/auth/2fa/setup')
    .set('X-CSRF-Token', csrfToken)
    .send({ currentPassword: TEST_PASSWORD })
    .expect(200);
  const secret = setupResponse.body.data.setup.secret;

  await agent
    .post('/api/auth/2fa/confirm')
    .set('X-CSRF-Token', csrfToken)
    .send({ code: generateTotpCode(secret) })
    .expect(200);

  return secret;
};

describe('Phase 5 sensitive authentication exchanges', () => {
  it('finalizes OAuth only from an opaque one-time HttpOnly handoff cookie', async () => {
    const app = await getTestApp();
    const user = await createUser();
    const state = randomBytes(24).toString('base64url');
    const handoffToken = randomBytes(32).toString('base64url');

    await OAuthHandoff.collection.insertOne({
      tokenHash: hash(handoffToken),
      userId: user._id,
      stateHash: hash(state),
      provider: 'google',
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const first = await request(app)
      .get('/api/auth/oauth/finalize')
      .set('Cookie', [
        `chatify_oauth_state=${state}`,
        `chatify_oauth_handoff=${handoffToken}`,
      ])
      .expect(302);

    expect(first.headers.location).toBe('http://localhost:5173/?auth=success');
    expect(first.headers.location).not.toContain('token=');

    const replay = await request(app)
      .get('/api/auth/oauth/finalize')
      .set('Cookie', [
        `chatify_oauth_state=${state}`,
        `chatify_oauth_handoff=${handoffToken}`,
      ])
      .expect(302);

    expect(replay.headers.location).toBe('http://localhost:5173/login?error=auth_failed');
  });

  it('rejects the former OAuth JWT query-credential exchange', async () => {
    const app = await getTestApp();
    const user = await createUser();
    const state = randomBytes(24).toString('base64url');
    const stateHash = hash(state);
    const jti = randomUUID();

    await OAuthHandoff.collection.insertOne({
      jti,
      userId: user._id,
      stateHash,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const legacyToken = jsonwebtoken.sign({
      userId: user._id,
      type: 'oauth_handoff',
      purpose: 'oauth_handoff',
      jti,
      stateHash,
    }, process.env.SECRET_JWT_KEY, { expiresIn: '60s' });

    const response = await request(app)
      .get('/api/auth/oauth/finalize')
      .set('Cookie', [`chatify_oauth_state=${state}`])
      .query({ token: legacyToken })
      .expect(302);

    expect(response.headers.location).toBe('http://localhost:5173/login?error=auth_failed');
  });

  it('allows only one concurrent reset request to consume a valid code', async () => {
    const app = await getTestApp();
    const user = await createUser();
    const code = '482901';

    await PasswordReset.create({
      userId: user._id,
      email: user.email,
      tokenHash: hashResetCode(code),
      attempts: 0,
      expiresAt: new Date(Date.now() + 5 * 60_000),
    });

    const firstAgent = request.agent(app);
    const secondAgent = request.agent(app);
    const [firstCsrf, secondCsrf] = await Promise.all([
      getCsrfForAgent(firstAgent),
      getCsrfForAgent(secondAgent),
    ]);

    const responses = await Promise.all([
      firstAgent
        .post('/api/auth/reset-password')
        .set('X-CSRF-Token', firstCsrf)
        .send({ email: user.email, code, newPassword: 'First replacement passphrase' }),
      secondAgent
        .post('/api/auth/reset-password')
        .set('X-CSRF-Token', secondCsrf)
        .send({ email: user.email, code, newPassword: 'Second replacement passphrase' }),
    ]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 400]);
    expect(await PasswordReset.countDocuments()).toBe(0);
  });

  it('rejects a two-factor challenge completed from different request metadata', async () => {
    const app = await getTestApp();
    const { agent, user } = await signupWithAgent();
    const csrfToken = await getCsrfForAgent(agent);
    const secret = await setupAndConfirmTwoFactor(agent, csrfToken);

    const loginAgent = request.agent(app);
    const loginCsrf = await getCsrfForAgent(loginAgent);
    const login = await loginAgent
      .post('/api/auth/login')
      .set('User-Agent', 'Phase5 Device A')
      .set('X-Forwarded-For', '203.0.113.10')
      .set('X-CSRF-Token', loginCsrf)
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(200);

    expect(login.body.status).toBe('mfa_required');

    const attackerAgent = request.agent(app);
    const attackerCsrf = await getCsrfForAgent(attackerAgent);
    await attackerAgent
      .post('/api/auth/2fa/challenge')
      .set('User-Agent', 'Phase5 Device B')
      .set('X-Forwarded-For', '198.51.100.42')
      .set('X-CSRF-Token', attackerCsrf)
      .send({
        challengeToken: login.body.data.challengeToken,
        code: generateTotpCode(secret),
      })
      .expect(401);
  });

  it('revokes every other session when two-factor security material changes', async () => {
    const { agent: currentAgent, user } = await signupWithAgent();
    const currentCsrf = await getCsrfForAgent(currentAgent);
    const otherLogin = await loginWithAgent({ email: user.email, autoCsrf: false });

    await setupAndConfirmTwoFactor(currentAgent, currentCsrf);

    await otherLogin.agent
      .get('/api/auth/sessions')
      .expect(401);

    await currentAgent
      .get('/api/auth/sessions')
      .expect(200);
  });
});
