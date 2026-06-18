import { z } from 'zod'
import { normalizeUsername, validateUsername } from './usernameValidation'

export const usernameSchema = z.string()
  .transform(normalizeUsername)
  .superRefine((value, ctx) => {
    const validation = validateUsername(value);

    if (!validation.ok) {
      ctx.addIssue({
        code: 'custom',
        message: validation.message,
      });
    }
  })

export const loginSchema = z.object({
  email: z
    .email('Please enter a valid email address')
    .min(1, 'Email is required'),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(100, 'Password must be less than 100 characters'),
    rememberMe: z.boolean().optional(),
})

export const signupSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .min(2, 'First name must be at least 2 characters')
    .max(30, 'First name must be less than 30 characters'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .max(30, 'Last name must be less than 30 characters'),
  username: usernameSchema,
  email: z
    .email('Please enter a valid email address')
    .min(1, 'Email is required'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters')
})

export const usernameSetupSchema = z.object({
  username: usernameSchema,
})

export type LoginFormData = z.infer<typeof loginSchema>
export type SignupFormData = z.infer<typeof signupSchema>
export type UsernameSetupFormData = z.infer<typeof usernameSetupSchema>
