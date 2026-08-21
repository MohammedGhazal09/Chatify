import { z } from 'zod'
import { normalizeUsername, validateUsername } from './usernameValidation'

const canonicalEmailSchema = z.string()
  .transform((value) => value.normalize('NFKC').trim().toLocaleLowerCase('en-US'))
  .pipe(z.email('Please enter a valid email address').min(1, 'Email is required'))

export const usernameSchema = z.string()
  .transform(normalizeUsername)
  .superRefine((value, ctx) => {
    const validation = validateUsername(value);
    if (!validation.ok) ctx.addIssue({ code: 'custom', message: validation.message });
  })

export const loginSchema = z.object({
  email: canonicalEmailSchema,
  password: z.string().min(1, 'Password is required').max(128, 'Password must be at most 128 characters'),
  rememberMe: z.boolean().optional(),
})

export const signupSchema = z.object({
  firstName: z.string().min(1, 'First name is required').min(2, 'First name must be at least 2 characters').max(30, 'First name must be less than 30 characters'),
  lastName: z.string().min(1, 'Last name is required').min(2, 'Last name must be at least 2 characters').max(30, 'Last name must be less than 30 characters'),
  username: usernameSchema,
  email: canonicalEmailSchema,
  password: z.string()
    .min(1, 'Password is required')
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password must be at most 128 characters')
    .refine((value) => value.trim().length > 0, 'Password cannot contain only whitespace')
    .refine((value) => !/[\u0000-\u001f\u007f-\u009f]/u.test(value), 'Password cannot contain control characters'),
})

export const usernameSetupSchema = z.object({ username: usernameSchema })

export type LoginFormData = z.infer<typeof loginSchema>
export type SignupFormData = z.infer<typeof signupSchema>
export type UsernameSetupFormData = z.infer<typeof usernameSetupSchema>
