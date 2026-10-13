import { z } from 'zod'

// The backend only checks the length (8, see user.validation.ts); the mix of character
// kinds is asked for here so people do not pick something trivially guessable.
export const passwordSchema = z
  .string()
  .min(8, { message: 'Passwords must be at least 8 characters' })
  .regex(/[^a-zA-Z0-9]/, {
    message: 'Passwords must have at least one non alphanumeric character',
  })
  .regex(/[a-z]/, {
    message: "Passwords must have at least one lowercase ('a'-'z')",
  })
  .regex(/[A-Z]/, {
    message: "Passwords must have at least one uppercase ('A'-'Z')",
  })
  .regex(/\d/, {
    message: "Passwords must have at least one digit ('0'-'9')",
  })
