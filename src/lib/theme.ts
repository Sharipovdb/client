import { useState } from 'react'

import { readStorageValue, writeStorageValue } from './local-storage'

export type ThemePreference = 'light' | 'dark' | 'system'

const themePreferences: ThemePreference[] = ['light', 'dark', 'system']

// The inline script in index.html reads this key too, so the first paint already has
// the right theme — keep the two in step.
const THEME_STORAGE_KEY = 'srp-transport.theme'

const darkSchemeQuery = '(prefers-color-scheme: dark)'

function readThemePreference(): ThemePreference {
  const stored = readStorageValue<unknown>(THEME_STORAGE_KEY, 'system')
  return (
    themePreferences.find((preference) => preference === stored) ?? 'system'
  )
}

function applyThemePreference(preference: ThemePreference) {
  const dark =
    preference === 'dark' ||
    (preference === 'system' && window.matchMedia(darkSchemeQuery).matches)

  document.documentElement.classList.toggle('dark', dark)
}

/** Applies the stored theme and keeps "system" following the OS while the app runs. */
export function initTheme() {
  applyThemePreference(readThemePreference())

  window
    .matchMedia(darkSchemeQuery)
    .addEventListener('change', () =>
      applyThemePreference(readThemePreference()),
    )
}

export function useThemePreference() {
  const [preference, setPreference] = useState(readThemePreference)

  function changePreference(next: ThemePreference) {
    writeStorageValue(THEME_STORAGE_KEY, next)
    applyThemePreference(next)
    setPreference(next)
  }

  return [preference, changePreference] as const
}
