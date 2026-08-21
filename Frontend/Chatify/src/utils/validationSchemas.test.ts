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
    const validInput = ['correct horse', ' battery staple'].join('');
    const spacedInput = ['  correct horse', ' battery staple  '].join('');
    const invalidInputs = [
      ['Short', '123!'].join(''),
      ' '.repeat(12),
      ['valid', ' passphrase', '\n'].join(''),
    ];

    expect(loginSchema.parse({
      email: '  Phase5.Identity@Example.TEST  ',
      password: validInput,
    }).email).toBe('phase5.identity@example.test');

    const valid = signupSchema.safeParse({
      firstName: 'Phase',
      lastName: 'Five',
      username: 'phase.five',
      email: 'Phase5@Example.TEST',
      password: spacedInput,
    });
    expect(valid.success).toBe(true);
    if (valid.success) expect(valid.data.password).toBe(spacedInput);

    for (const invalidInput of invalidInputs) {
      expect(signupSchema.safeParse({
        firstName: 'Phase',
        lastName: 'Five',
        username: 'phase.five',
        email: 'phase5@example.test',
        password: invalidInput,
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
