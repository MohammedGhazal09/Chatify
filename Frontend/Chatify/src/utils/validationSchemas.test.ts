import { describe, expect, it } from 'vitest';
import {
  signupSchema,
  usernameSchema,
  usernameSetupSchema,
} from './validationSchemas';

describe('username validation schemas', () => {
  it('normalizes valid usernames', () => {
    expect(usernameSchema.parse('  Ahmed.Musa_1  ')).toBe('ahmed.musa_1');
    expect(usernameSetupSchema.parse({ username: 'Grace.Hopper' })).toEqual({
      username: 'grace.hopper',
    });
  });

  it('rejects invalid and reserved usernames', () => {
    for (const username of [
      '',
      'ab',
      '.ahmed',
      'ahmed.',
      'ahmed..musa',
      'ahmed__musa',
      'ahmed-musa',
      'admin',
      'a'.repeat(25),
    ]) {
      expect(() => usernameSchema.parse(username)).toThrow();
    }
  });

  it('requires username for signup', () => {
    const result = signupSchema.safeParse({
      firstName: 'Ahmed',
      lastName: 'Musa',
      email: 'ahmed@example.com',
      password: 'password123',
    });

    expect(result.success).toBe(false);
  });
});
