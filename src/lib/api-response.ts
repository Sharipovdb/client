import type { ApiResponse } from './api-client'

// Endpoints wrapped in ApiResponse answer HTTP 200 even when they refuse, so axios never
// throws for them — the refusal is only in the body.
export function ensureSucceeded(
  response: ApiResponse<unknown>,
  fallbackMessage: string,
) {
  if (!response.isSuccess) {
    throw new Error(response.message ?? fallbackMessage)
  }
}
