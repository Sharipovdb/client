import { useState } from 'react'

import { readStorageValue, writeStorageValue } from './local-storage'

export type ThemePreference = 'light' | 'dark'

const themePreferences: ThemePreference[] = ['light', 'dark']

// The inline script in index.html reads this key too, so the first paint already has
// the right theme — keep the two in step.
const THEME_STORAGE_KEY = 'srp-transport.theme'

// Light unless the user picks dark. The OS setting is deliberately ignored: a dark OS
// should not switch the app on its own.
function readThemePreference(): ThemePreference {
  const stored = readStorageValue<unknown>(THEME_STORAGE_KEY, 'light')
  return themePreferences.find((preference) => preference === stored) ?? 'light'
}

function applyThemePreference(preference: ThemePreference) {
  document.documentElement.classList.toggle('dark', preference === 'dark')
}

export function initTheme() {
  applyThemePreference(readThemePreference())
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
