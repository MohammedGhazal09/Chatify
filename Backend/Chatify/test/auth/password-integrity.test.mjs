import { describe, expect, it } from 'vitest';
import User from '../../Models/userModel.mjs';
import { uniqueEmail, uniqueUsername } from '../fixtures/users.mjs';

describe('password integrity', () => {
  it('preserves leading and trailing password characters before hashing', async () => {
    const password = '  ExactPassword123!  ';
    const user = await User.create({
      firstName: 'Password',
      lastName: 'Integrity',
      email: uniqueEmail('password-integrity'),
      username: uniqueUsername('password-integrity'),
      password,
      authProvider: 'local',
    });
    const stored = await User.findById(user._id).select('+password');

    await expect(stored.checkPassword(password)).resolves.toBe(true);
    await expect(stored.checkPassword(password.trim())).resolves.toBe(false);
  });
});
