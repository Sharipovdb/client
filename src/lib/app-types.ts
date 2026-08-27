export const appRoles = [
  'Admin',
  'RouteManager',
  'CrewLead',
  'DriverLead',
  'Worker',
  'Accountant',
] as const

export type AppRole = (typeof appRoles)[number]

export interface AuthSession {
  id: number
  email: string
  userName: string
  fullname: string
  phoneNumber: string
  telegramId: string
  roles: AppRole[]
}

export const roleLabels: Record<AppRole, string> = {
  Admin: 'Admin',
  RouteManager: 'Route Manager',
  CrewLead: 'Crew Lead',
  DriverLead: 'Driver Lead',
  Worker: 'Worker',
  Accountant: 'Accountant',
}

// The backend's Identity role names (Transportation.Shared.Authorization.RoleNames)
// line up 1:1 with AppRole by design — this is the one place that mapping lives.
const backendRoleToAppRole: Partial<Record<string, AppRole>> = {
  Admin: 'Admin',
  RouteManager: 'RouteManager',
  CrewLead: 'CrewLead',
  DriverLead: 'DriverLead',
  Worker: 'Worker',
  Accountant: 'Accountant',
}

// A backend account can hold multiple roles; the frontend models one role per
// session, so the first recognized role wins — a deliberate simplification, every
// seeded account currently has exactly one role anyway.
export function resolveAppRole(backendRoles: string[]): AppRole | null {
  for (const roleName of backendRoles) {
    const appRole = backendRoleToAppRole[roleName]

    if (appRole) {
      return appRole
    }
  }

  return null
}

// The inverse lookup, for the one place that assigns/removes a backend role
// (features/employees/employees-context.tsx) — derived so the two directions can
// never drift apart.
export const appRoleToBackendRole = Object.fromEntries(
  Object.entries(backendRoleToAppRole).map(([backendRole, appRole]) => [
    appRole,
    backendRole,
  ]),
) as Record<AppRole, string>
