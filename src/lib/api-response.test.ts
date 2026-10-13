import { describe, expect, it } from 'vitest'

import { ensureSucceeded } from './api-response'

describe('ensureSucceeded', () => {
  it('lets a successful response through', () => {
    expect(() =>
      ensureSucceeded(
        { isSuccess: true, statusCode: 200, message: 'Done', data: null },
        'Failed.',
      ),
    ).not.toThrow()
  })

  // User endpoints answer HTTP 200 even when they refuse, so the refusal has to be
  // read from the body or it would look like success.
  it('turns a refusal in the body into an error carrying its message', () => {
    expect(() =>
      ensureSucceeded(
        {
          isSuccess: false,
          statusCode: 400,
          message: 'The current password is incorrect.',
          data: null,
        },
        'Failed.',
      ),
    ).toThrow(new Error('The current password is incorrect.'))
  })

  it('falls back to the given message when the body has none', () => {
    expect(() =>
      ensureSucceeded(
        { isSuccess: false, statusCode: 404, message: null, data: null },
        'Failed.',
      ),
    ).toThrow(new Error('Failed.'))
  })
})
