import { describe, expect, it } from 'vitest'

import { passwordSchema } from './password-rules'

function errorsOf(password: string) {
  const result = passwordSchema.safeParse(password)

  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('passwordSchema', () => {
  it('accepts a password the backend accepts too', () => {
    expect(errorsOf('Strong-Pass1')).toEqual([])
  })

  it('asks for at least 8 characters, as the backend does', () => {
    expect(errorsOf('Ab1!xyz')).toEqual([
      'Passwords must be at least 8 characters',
    ])
  })

  it('keeps asking for a mix of character kinds', () => {
    expect(errorsOf('lowercase-only1')).toEqual([
      "Passwords must have at least one uppercase ('A'-'Z')",
    ])
  })
})
