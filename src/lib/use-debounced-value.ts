import { useEffect, useState } from 'react'

/**
 * The value as it was `delayMs` ago, once it has stopped changing.
 *
 * Used where a keystroke would otherwise start a request: the kilometre index reprices a
 * whole month server-side, and typing "12.5" should ask for one answer rather than four.
 */
export function useDebouncedValue<T>(value: T, delayMs = 400) {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)

    return () => clearTimeout(timer)
  }, [value, delayMs])

  return settled
}
