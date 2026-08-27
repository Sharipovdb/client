import { useAuth } from '@/features/auth/auth-context'
import { hasCapability } from '@/lib/permissions'
import type { Capability } from '@/lib/permissions'

export function useCapability(capability: Capability): boolean {
  const { session } = useAuth()
  return session ? hasCapability(session.roles, capability) : false
}
