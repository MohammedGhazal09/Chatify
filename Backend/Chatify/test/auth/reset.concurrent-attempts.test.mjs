import { beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordReset from '../../Models/passwordResetModel.mjs';
import { sendPasswordResetEmail } from '../../Services/emailService.mjs';
import { createAgent, getCsrfForAgent, signupWithAgent } from '../helpers/authAgent.mjs';

vi.mock('../../Services/emailService.mjs', () => ({
  sendPasswordResetEmail: vi.fn(),
}));

const postAuth = (agent, csrfToken, path, body) => agent
  .post(`/api/auth/${path}`)
  .set('X-CSRF-Token', csrfToken)
  .send(body);

describe('concurrent password-reset attempt accounting', () => {
  beforeEach(() => {
    sendPasswordResetEmail.mockReset();
    sendPasswordResetEmail.mockResolvedValue({ messageId: 'concurrent-reset-email' });
  });

  it('invalidates the record after at most five concurrent incorrect guesses', async () => {
    const { user } = await signupWithAgent({
      firstName: 'Concurrent',
      lastName: 'Reset',
    });
    const agent = await createAgent();
    const csrfToken = await getCsrfForAgent(agent);

    await postAuth(agent, csrfToken, 'forgot-password', {
      email: user.email,
    }).expect(200);
    const correctCode = sendPasswordResetEmail.mock.calls.at(-1)?.[1];

    const responses = await Promise.all(Array.from({ length: 12 }, () => (
      postAuth(agent, csrfToken, 'verify-reset-code', {
        email: user.email,
        code: '000000',
      })
    )));

    expect(responses.every((response) => response.status === 400)).toBe(true);
    await expect(PasswordReset.findOne({ email: user.email })).resolves.toBeNull();
    await postAuth(agent, csrfToken, 'verify-reset-code', {
      email: user.email,
      code: correctCode,
    }).expect(400);
  });
});
