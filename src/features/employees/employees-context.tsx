import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'

import { apiClient } from '@/lib/api-client'
import type { ApiResponse } from '@/lib/api-client'
// import { appRoleToBackendRole, resolveAppRole } from '@/lib/app-types'
import { isSameId } from '@/lib/domain-types'
import type { Employee, EntityId } from '@/lib/domain-types'
import type { AppRole } from '@/lib/app-types'

// Raw shape of Transportation.Application.User.Models.UserDto — note the backend's
// own casing (`firstname`, not `firstName`) and that role membership travels
// separately from everything else (assign/remove, not a field on Update).
interface UserApiDto {
  id: number
  email: string
  userName: string
  fullname: string
  password: string
  phoneNumber: string
  telegramId: string
  roles: AppRole[]
}

export interface EmployeeDraft {
  email: string | null
  userName: string
  fullname: string
  password?: string
  phoneNumber: string
  telegramId: string | null
  roles: AppRole[]
}

export const EMPLOYEES_QUERY_KEY = ['employees']

// Every account created from this page shares one password — there's no invite-email
// flow in this pass (mirrors the seeded demo accounts' convention, see
// Backend/.../Seeders/UserDatabaseSeeder.cs).

// function toEmployee(dto: UserApiDto): Employee | null {
//   const role = resolveAppRole(dto.roles)

//   // The technical Admin account (and anyone with no recognized role yet) isn't a
//   // business "Employee" per the PRD's role list.
//   if (!role || role === 'admin') {
//     return null
//   }

//   return {
//     id: String(dto.id),
//     firstName: dto.firstname,
//     lastName: dto.lastName,
//     phoneNumber: dto.phoneNumber,
//     telegramId: dto.telegramId,
//     role,
//   }
// }

// function syntheticEmail(phoneNumber: string) {
//   return `user${phoneNumber.replace(/\D/g, '')}@srp.local`
// }

async function fetchEmployees() {
  const response =
    await apiClient.get<ApiResponse<UserApiDto[]>>('/api/User/GetAll')
  const users = response.data.data ?? []
  const usersById = new Map(users.map((user) => [Number(user.id), user]))
  const employees = users
  // .map(toEmployee)
  // .filter((employee): employee is Employee => employee !== null)

  return { employees, usersById }
}

async function fetchEmployeesByRole(role: AppRole) {
  const response = await apiClient.get<ApiResponse<UserApiDto[]>>(
    `/api/User/GetUsersByRole/${role}`,
  )

  return response.data.data ?? []
}

interface EmployeesContextValue {
  employees: Employee[]
  isLoading: boolean
  addEmployee: (draft: EmployeeDraft) => Promise<void>
  updateEmployee: (employeeId: number, draft: EmployeeDraft) => Promise<void>
  deleteEmployee: (employeeId: number) => Promise<void>
  getEmployeeById: (
    employeeId: EntityId | null | undefined,
  ) => Employee | undefined
  getEmployeeDisplayName: (employeeId: EntityId | null | undefined) => string
}

const EmployeesContext = createContext<EmployeesContextValue | null>(null)

export function EmployeesProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: EMPLOYEES_QUERY_KEY,
    queryFn: fetchEmployees,
  })

  const employees = data?.employees ?? []
  // const usersById = data?.usersById

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY })
  }

  const addMutation = useMutation({
    mutationFn: async (draft: EmployeeDraft) => {
      const phoneNumber = draft.phoneNumber.trim()

      await apiClient.post('/api/User/Create', {
        email: draft.email,
        userName: draft.userName,
        fullname: draft.fullname,
        password: draft.password,
        phoneNumber,
        telegramId: draft.telegramId,
        roles: draft.roles,
      })

      // Create only returns a message, not the new user — look it up by the
      // username we just assigned (the phone number) so we can grant the role. The
      // route is api/User/GetByName + the action's own "by-name/{username}" template.
      // const created = await apiClient.get<ApiResponse<UserApiDto>>(
      //   `/api/User/GetByName/by-name/${encodeURIComponent(phoneNumber)}`,
      // )
      // const userId = created.data.data?.id

      // if (userId) {
      //   await apiClient.post('/api/roles/assign', {
      //     roleName: 'Worker',
      //     userId,
      //   })
      // }
    },
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      employeeId,
      draft,
    }: {
      employeeId: number
      draft: EmployeeDraft
    }) => {
      // const existing = usersById?.get(employeeId)
      // const previousRole = existing ? resolveAppRole(existing.roles) : null
      const phoneNumber = draft.phoneNumber.trim()

      await apiClient.put('/api/User/Update', {
        id: Number(employeeId),
        email: draft.email,
        userName: draft.userName,
        fullname: draft.fullname,
        phoneNumber,
        telegramId: draft.telegramId,
        roles: draft.roles,
      })

      // if (previousRole && previousRole !== draft.role) {
      //   await apiClient.post('/api/roles/remove', {
      //     roleName: appRoleToBackendRole[previousRole],
      //     userId: Number(employeeId),
      //   })
      //   await apiClient.post('/api/roles/assign', {
      //     roleName: appRoleToBackendRole[draft.role],
      //     userId: Number(employeeId),
      //   })
      // }
    },
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (employeeId: number) =>
      apiClient.delete(`/api/User/Delete/${employeeId}`),
    onSuccess: invalidate,
  })

  const value = useMemo<EmployeesContextValue>(
    () => ({
      employees,
      isLoading,
      addEmployee: async (draft) => {
        await addMutation.mutateAsync(draft)
      },
      updateEmployee: async (employeeId, draft) => {
        await updateMutation.mutateAsync({ employeeId, draft })
      },
      deleteEmployee: async (employeeId) => {
        await deleteMutation.mutateAsync(employeeId)
      },
      getEmployeeById: (employeeId) =>
        employees.find((employee) => isSameId(employee.id, employeeId)),
      getEmployeeDisplayName: (employeeId) => {
        const employee = employees.find((candidate) =>
          isSameId(candidate.id, employeeId),
        )

        return employee ? employee.fullname : 'Unknown'
      },
    }),
    [employees, isLoading, addMutation, updateMutation, deleteMutation],
  )

  return (
    <EmployeesContext.Provider value={value}>
      {children}
    </EmployeesContext.Provider>
  )
}

export function useEmployees() {
  const context = useContext(EmployeesContext)

  if (!context) {
    throw new Error('useEmployees must be used inside EmployeesProvider')
  }

  return context
}

export function useUsersByRole(role: AppRole | undefined) {
  return useQuery({
    queryKey: ['users', 'role', role],
    queryFn: () => fetchEmployeesByRole(role!),
    enabled: !!role,
  })
}
