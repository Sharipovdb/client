import { useMemo } from 'react'

import type { Capability } from '@/lib/permissions'
import { canAccessPath, hasCapability } from '@/lib/permissions'

import { useAuth } from './auth-context'

// Thin wrapper over the permission rules so components never touch the session role
// directly. Everything resolves to `false` when signed out.
export function usePermissions() {
  const { session } = useAuth()
  const roles = session?.roles ?? null

  return useMemo(
    () => ({
      roles,
      can: (capability: Capability) =>
        roles ? hasCapability(roles, capability) : false,
      canOpen: (pathname: string) =>
        roles ? canAccessPath(roles, pathname) : false,
    }),
    [roles],
  )
}
