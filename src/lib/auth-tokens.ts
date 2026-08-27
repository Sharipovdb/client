import type { AuthSession } from './app-types'
import { readStorageValue, removeStorageValue, writeStorageValue } from './local-storage'

const TOKENS_STORAGE_KEY = 'srp-transport.auth.tokens'
const SESSION_STORAGE_KEY = 'srp-transport.auth.session'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export function getAuthTokens() {
  return readStorageValue<AuthTokens | null>(TOKENS_STORAGE_KEY, null)
}

export function setAuthTokens(tokens: AuthTokens) {
  writeStorageValue(TOKENS_STORAGE_KEY, tokens)
}

// A stored session is only valid alongside tokens. A session without tokens — e.g.
// left over from an older build that reused this key, or after a failed refresh —
// must NOT count as logged in: otherwise every entity query fires with no token,
// 401s, the refresh fails, and the redirect-to-login hard-reloads forever.
export function getStoredSession(): AuthSession | null {
  if (!getAuthTokens()) {
    return null
  }

  return readStorageValue<AuthSession | null>(SESSION_STORAGE_KEY, null)
}

export function setStoredSession(session: AuthSession) {
  writeStorageValue(SESSION_STORAGE_KEY, session)
}

// Clears every auth artifact at once, so the session and tokens can never desync.
// Used on explicit logout and whenever a token refresh fails.
export function clearAuth() {
  removeStorageValue(TOKENS_STORAGE_KEY)
  removeStorageValue(SESSION_STORAGE_KEY)
}
