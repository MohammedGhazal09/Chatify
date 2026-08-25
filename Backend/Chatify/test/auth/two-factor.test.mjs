import request from 'supertest';
import { describe, expect, it } from 'vitest';
import User from '../../Models/userModel.mjs';
import { generateTotpCode } from '../../Utils/twoFactor.mjs';
import { TEST_PASSWORD } from '../fixtures/users.mjs';
import { getCsrfForAgent, signupWithAgent } from '../helpers/authAgent.mjs';
import { getTestApp } from '../setup/app.mjs';

const getAccessTokenCookie = (response) => {
  const cookies = response.headers['set-cookie'] ?? [];
  return cookies.find((cookie) => cookie.startsWith('accessToken='));
};

const getRefreshTokenCookie = (response) => {
  const cookies = response.headers['set-cookie'] ?? [];
  return cookies.find((cookie) => cookie.startsWith('refreshToken='));
};

const setupAndConfirmTwoFactor = async (agent, csrfToken) => {
  const setupResponse = await agent
    .post('/api/auth/2fa/setup')
    .set('X-CSRF-Token', csrfToken)
    .send({ currentPassword: TEST_PASSWORD })
    .expect(200);
  const secret = setupResponse.body.data.setup.secret;

  const confirmResponse = await agent
    .post('/api/auth/2fa/confirm')
    .set('X-CSRF-Token', csrfToken)
    .send({ code: generateTotpCode(secret) })
    .expect(200);

  return {
    secret,
    backupCodes: confirmResponse.body.data.backupCodes,
  };
};

const startTwoFactorLogin = async ({ email, password = TEST_PASSWORD }) => {
  const app = await getTestApp();
  const agent = request.agent(app);
  const csrfToken = await getCsrfForAgent(agent);
  const response = await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ email, password, rememberMe: true })
    .expect(200);

  return { agent, csrfToken, response };
};

describe('two-factor authentication', () => {
  it('requires a second factor before issuing login cookies', async () => {
    const { agent, user } = await signupWithAgent();
    const csrfToken = await getCsrfForAgent(agent);
    const { secret } = await setupAndConfirmTwoFactor(agent, csrfToken);

    const login = await startTwoFactorLogin({ email: user.email });

    expect(login.response.body.status).toBe('mfa_required');
    expect(login.response.body.data.twoFactorRequired).toBe(true);
    expect(login.response.body.data.challengeToken).toEqual(expect.any(String));
    expect(getAccessTokenCookie(login.response)).toBeUndefined();
    expect(getRefreshTokenCookie(login.response)).toBeUndefined();

    const verifyResponse = await login.agent
      .post('/api/auth/2fa/challenge')
      .set('X-CSRF-Token', login.csrfToken)
      .send({
        challengeToken: login.response.body.data.challengeToken,
        code: generateTotpCode(secret),
      })
      .expect(200);

    expect(getAccessTokenCookie(verifyResponse)).toBeTruthy();
    expect(getRefreshTokenCookie(verifyResponse)).toBeTruthy();

    await login.agent
      .get('/api/auth/sessions')
      .expect(200);
  });

  it('stores backup codes as hashes and rejects backup-code reuse', async () => {
    const { agent, user } = await signupWithAgent();
    const csrfToken = await getCsrfForAgent(agent);
    const { backupCodes } = await setupAndConfirmTwoFactor(agent, csrfToken);
    const firstBackupCode = backupCodes[0];

    const storedUser = await User.findById(user._id)
      .select('+twoFactor.backupCodes +twoFactor.backupCodes.codeHash');

    expect(storedUser.twoFactor.backupCodes).toHaveLength(10);
    expect(storedUser.twoFactor.backupCodes[0].codeHash).toEqual(expect.any(String));
    expect(storedUser.twoFactor.backupCodes[0].codeHash).not.toContain(firstBackupCode.replace('-', ''));

    const firstLogin = await startTwoFactorLogin({ email: user.email });

    await firstLogin.agent
      .post('/api/auth/2fa/challenge')
      .set('X-CSRF-Token', firstLogin.csrfToken)
      .send({
        challengeToken: firstLogin.response.body.data.challengeToken,
        code: firstBackupCode,
      })
      .expect(200);

    const afterUse = await User.findById(user._id)
      .select('+twoFactor.backupCodes +twoFactor.backupCodes.codeHash');

    expect(afterUse.twoFactor.backupCodes.filter((backupCode) => !backupCode.usedAt)).toHaveLength(9);

    const replayLogin = await startTwoFactorLogin({ email: user.email });

    await replayLogin.agent
      .post('/api/auth/2fa/challenge')
      .set('X-CSRF-Token', replayLogin.csrfToken)
      .send({
        challengeToken: replayLogin.response.body.data.challengeToken,
        code: firstBackupCode,
      })
      .expect(401);
  });

  it('supports status, backup-code regeneration, and disabling with password plus TOTP', async () => {
    const { agent, user } = await signupWithAgent();
    const csrfToken = await getCsrfForAgent(agent);
    const { secret, backupCodes } = await setupAndConfirmTwoFactor(agent, csrfToken);

    const statusResponse = await agent
      .get('/api/auth/2fa/status')
      .expect(200);

    expect(statusResponse.body.data.twoFactor).toMatchObject({
      enabled: true,
      available: true,
      backupCodesRemaining: 10,
      pendingSetup: false,
    });

    await agent
      .post('/api/auth/2fa/backup-codes/regenerate')
      .set('X-CSRF-Token', csrfToken)
      .send({
        currentPassword: 'WrongPassword123!',
        code: generateTotpCode(secret),
      })
      .expect(401);

    const regenerateResponse = await agent
      .post('/api/auth/2fa/backup-codes/regenerate')
      .set('X-CSRF-Token', csrfToken)
      .send({
        currentPassword: TEST_PASSWORD,
        code: generateTotpCode(secret),
      })
      .expect(200);

    expect(regenerateResponse.body.data.backupCodes).toHaveLength(10);
    expect(regenerateResponse.body.data.backupCodes).not.toEqual(backupCodes);

    await agent
      .post('/api/auth/2fa/disable')
      .set('X-CSRF-Token', csrfToken)
      .send({
        currentPassword: TEST_PASSWORD,
        code: generateTotpCode(secret),
      })
      .expect(200);

    const freshLogin = await startTwoFactorLogin({ email: user.email });

    expect(freshLogin.response.body.status).toBe('success');
    expect(getAccessTokenCookie(freshLogin.response)).toBeTruthy();
    expect(getRefreshTokenCookie(freshLogin.response)).toBeTruthy();
  });
});
