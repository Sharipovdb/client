// Minimal JWT payload decoder — we only need to read claims client-side (role, sub),
// never verify the signature (the backend already did that), so no dependency needed.

export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  const payload = token.split('.')[1]

  if (!payload) {
    return null
  }

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    )

    return JSON.parse(json) as T
  } catch {
    return null
  }
}
