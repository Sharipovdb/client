import { describe, expect, it } from 'vitest'

import { passwordFormSchema } from './password-form'

function errorsOf(askCurrentPassword: boolean, values: object) {
  const result = passwordFormSchema(askCurrentPassword).safeParse(values)

  return result.success
    ? {}
    : Object.fromEntries(
        result.error.issues.map((issue) => [
          issue.path.join('.'),
          issue.message,
        ]),
      )
}

const newPassword = 'Strong-Pass1'

describe('passwordFormSchema', () => {
  it('accepts a new password typed the same way twice', () => {
    expect(
      errorsOf(false, {
        currentPassword: '',
        newPassword,
        confirmPassword: newPassword,
      }),
    ).toEqual({})
  })

  it('catches a typo in the repeated password', () => {
    expect(
      errorsOf(false, {
        currentPassword: '',
        newPassword,
        confirmPassword: 'Strong-Pass2',
      }),
    ).toEqual({ confirmPassword: 'The passwords do not match.' })
  })

  it('asks for the current password when changing your own', () => {
    expect(
      errorsOf(true, {
        currentPassword: '',
        newPassword,
        confirmPassword: newPassword,
      }),
    ).toEqual({ currentPassword: 'Enter your current password.' })
  })
})
