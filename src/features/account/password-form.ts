import { z } from 'zod'

import { passwordSchema } from '@/lib/password-rules'

// The same form serves an admin resetting someone's forgotten password and a person
// changing their own; only the latter has to prove they know the current one.
export function passwordFormSchema(askCurrentPassword: boolean) {
  return z
    .object({
      currentPassword: z.string(),
      newPassword: passwordSchema,
      confirmPassword: z.string(),
    })
    .superRefine((values, context) => {
      if (askCurrentPassword && !values.currentPassword) {
        context.addIssue({
          code: 'custom',
          path: ['currentPassword'],
          message: 'Enter your current password.',
        })
      }

      if (values.confirmPassword !== values.newPassword) {
        context.addIssue({
          code: 'custom',
          path: ['confirmPassword'],
          message: 'The passwords do not match.',
        })
      }
    })
}

export type PasswordFormValues = z.infer<ReturnType<typeof passwordFormSchema>>
