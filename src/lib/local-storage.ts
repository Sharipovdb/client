export function readStorageValue<T>(key: string, fallbackValue: T): T {
  if (typeof window === 'undefined') {
    return fallbackValue
  }

  const storedValue = window.localStorage.getItem(key)

  if (!storedValue) {
    return fallbackValue
  }

  try {
    return JSON.parse(storedValue) as T
  } catch {
    return fallbackValue
  }
}

export function writeStorageValue<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

export function removeStorageValue(key: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(key)
}