import { beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordReset from '../../Models/passwordResetModel.mjs';
import { sendPasswordResetEmail } from '../../Services/emailService.mjs';
import { createAgent, getCsrfForAgent, loginWithAgent, signupWithAgent } from '../helpers/authAgent.mjs';

vi.mock('../../Services/emailService.mjs', () => ({
  sendPasswordResetEmail: vi.fn(),
}));

const resetRequestAgent = async () => {
  const agent = await createAgent();
  const csrfToken = await getCsrfForAgent(agent);
  return { agent, csrfToken };
};

const postAuth = (agent, csrfToken, path, body) => agent
  .post(`/api/auth/${path}`)
  .set('X-CSRF-Token', csrfToken)
  .send(body);

const requestResetCode = async (email) => {
  const { agent, csrfToken } = await resetRequestAgent();

  await postAuth(agent, csrfToken, 'forgot-password', { email }).expect(200);

  const lastCall = sendPasswordResetEmail.mock.calls.at(-1);
  return { agent, csrfToken, code: lastCall?.[1] };
};

describe('password reset security', () => {
  beforeEach(() => {
    sendPasswordResetEmail.mockReset();
    sendPasswordResetEmail.mockResolvedValue({ messageId: 'test-reset-email' });
  });

  it('does not enumerate accounts on forgot-password requests', async () => {
    const { agent, csrfToken } = await resetRequestAgent();

    const response = await postAuth(agent, csrfToken, 'forgot-password', {
      email: 'missing-reset-user@example.test',
    }).expect(200);

    expect(response.body.message).toMatch(/If an account with that email exists/i);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    await expect(PasswordReset.countDocuments()).resolves.toBe(0);
  });

  it('stores reset codes as hashes instead of raw six-digit codes', async () => {
    const { user } = await signupWithAgent({ firstName: 'Reset', lastName: 'Hash' });
    const { code } = await requestResetCode(user.email);
    const resetRecord = await PasswordReset.findOne({ email: user.email }).lean();

    expect(code).toMatch(/^\d{6}$/);
    expect(resetRecord.token).toBeUndefined();
    expect(resetRecord.tokenHash).toEqual(expect.any(String));
    expect(resetRecord.tokenHash).not.toBe(code);
    expect(resetRecord.attempts).toBe(0);
  });

  it('rejects expired reset codes', async () => {
    const { user } = await signupWithAgent({ firstName: 'Reset', lastName: 'Expired' });
    const { agent, csrfToken, code } = await requestResetCode(user.email);

    await PasswordReset.updateOne(
      { email: user.email },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );

    const response = await postAuth(agent, csrfToken, 'verify-reset-code', {
      email: user.email,
      code,
    }).expect(400);

    expect(response.body.message).toMatch(/Invalid or expired reset code/i);
  });

  it('invalidates the active reset record after five failed attempts', async () => {
    const { user } = await signupWithAgent({ firstName: 'Reset', lastName: 'Attempts' });
    const { agent, csrfToken, code } = await requestResetCode(user.email);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await postAuth(agent, csrfToken, 'verify-reset-code', {
        email: user.email,
        code: '000000',
      }).expect(400);
    }

    await expect(PasswordReset.findOne({ email: user.email })).resolves.toBeNull();

    await postAuth(agent, csrfToken, 'verify-reset-code', {
      email: user.email,
      code,
    }).expect(400);
  });

  it('resets the password once and rejects code reuse', async () => {
    const { user, payload } = await signupWithAgent({ firstName: 'Reset', lastName: 'SingleUse' });
    const { agent, csrfToken, code } = await requestResetCode(user.email);

    await postAuth(agent, csrfToken, 'reset-password', {
      email: user.email,
      code,
      newPassword: 'NewPassword123!',
    }).expect(200);

    await loginWithAgent({
      email: user.email,
      password: payload.password,
      autoCsrf: false,
    }).then(
      () => {
        throw new Error('Old password should not authenticate after reset');
      },
      (error) => {
        expect(error.message).toMatch(/login failed/i);
      }
    );

    await loginWithAgent({
      email: user.email,
      password: 'NewPassword123!',
    });

    await postAuth(agent, csrfToken, 'reset-password', {
      email: user.email,
      code,
      newPassword: 'AnotherPassword123!',
    }).expect(400);
  });
});
