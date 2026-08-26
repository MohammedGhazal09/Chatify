import request from 'supertest';
import { describe, expect, it } from 'vitest';
import User from '../../Models/userModel.mjs';
import { generateTotpCode } from '../../Utils/twoFactor.mjs';
import { TEST_PASSWORD } from '../fixtures/users.mjs';
import { getCsrfForAgent, signupWithAgent } from '../helpers/authAgent.mjs';
import { getTestApp } from '../setup/app.mjs';

const setupTwoFactor = async (agent, csrfToken) => {
  const setup = await agent
    .post('/api/auth/2fa/setup')
    .set('X-CSRF-Token', csrfToken)
    .send({ currentPassword: TEST_PASSWORD })
    .expect(200);
  const secret = setup.body.data.setup.secret;
  const confirmed = await agent
    .post('/api/auth/2fa/confirm')
    .set('X-CSRF-Token', csrfToken)
    .send({ code: generateTotpCode(secret) })
    .expect(200);
  return confirmed.body.data.backupCodes;
};

describe('concurrent two-factor challenge consumption', () => {
  it('allows one session and one backup-code consumption for concurrent requests', async () => {
    const { agent: setupAgent, user } = await signupWithAgent({
      firstName: 'Concurrent',
      lastName: 'TwoFactor',
    });
    const setupCsrf = await getCsrfForAgent(setupAgent);
    const backupCodes = await setupTwoFactor(setupAgent, setupCsrf);
    const app = await getTestApp();
    const loginAgent = request.agent(app);
    const loginCsrf = await getCsrfForAgent(loginAgent);
    const login = await loginAgent
      .post('/api/auth/login')
      .set('X-CSRF-Token', loginCsrf)
      .send({
        email: user.email,
        password: TEST_PASSWORD,
        rememberMe: true,
      })
      .expect(200);
    const challengeToken = login.body.data.challengeToken;
    const body = {
      challengeToken,
      code: backupCodes[0],
    };

    const responses = await Promise.all([
      loginAgent
        .post('/api/auth/2fa/challenge')
        .set('X-CSRF-Token', loginCsrf)
        .send(body),
      loginAgent
        .post('/api/auth/2fa/challenge')
        .set('X-CSRF-Token', loginCsrf)
        .send(body),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);

    const storedUser = await User.findById(user._id)
      .select('+twoFactor.backupCodes +twoFactor.backupCodes.codeHash');
    expect(storedUser.twoFactor.backupCodes.filter((entry) => entry.usedAt)).toHaveLength(1);
    expect(storedUser.twoFactor.backupCodes.filter((entry) => !entry.usedAt)).toHaveLength(9);
  });
});
