import { describe, expect, it } from 'vitest';
import {
  loginSchema,
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

  it('canonicalizes authentication email and enforces the Phase 5 password policy', () => {
    expect(loginSchema.parse({
      email: '  Phase5.Identity@Example.TEST  ',
      password: 'correct horse battery staple',
    }).email).toBe('phase5.identity@example.test');

    const valid = signupSchema.safeParse({
      firstName: 'Phase',
      lastName: 'Five',
      username: 'phase.five',
      email: 'Phase5@Example.TEST',
      password: '  correct horse battery staple  ',
    });
    expect(valid.success).toBe(true);
    if (valid.success) expect(valid.data.password).toBe('  correct horse battery staple  ');

    for (const password of ['Short123!', '            ', 'valid passphrase\n']) {
      expect(signupSchema.safeParse({
        firstName: 'Phase',
        lastName: 'Five',
        username: 'phase.five',
        email: 'phase5@example.test',
        password,
      }).success).toBe(false);
    }
  });

  it('requires username for signup', () => {
    const result = signupSchema.safeParse({
      firstName: 'Ahmed',
      lastName: 'Musa',
      email: 'ahmed@example.com',
      password: 'password1234',
    });

    expect(result.success).toBe(false);
  });
});
