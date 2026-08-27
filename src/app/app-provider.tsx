import type { ReactNode } from 'react'

import { AuthProvider, useAuth } from '@/features/auth/auth-context'
import { CrewMembershipsProvider } from '@/features/crews/crew-memberships-context'
import { CrewsProvider } from '@/features/crews/crews-context'
import { EmployeesProvider } from '@/features/employees/employees-context'
import { MonthlySheetsProvider } from '@/features/monthly-sheets/monthly-sheets-context'
import { RoutesProvider } from '@/features/routes/routes-context'
import { TaxiExpensesProvider } from '@/features/taxi-expenses/taxi-expenses-context'
import { TariffsProvider } from '@/features/tariffs/tariffs-context'
import { TransportDaysProvider } from '@/features/transport-days/transport-days-context'
import { VehiclesProvider } from '@/features/vehicles/vehicles-context'

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthenticatedProviders>{children}</AuthenticatedProviders>
    </AuthProvider>
  )
}

// Every context below fetches from the API as soon as it mounts. Gating them behind
// isAuthenticated (rather than adding `enabled: isAuthenticated` to each of their
// useQuery calls individually) keeps the guard in one place instead of eight — the
// login page itself needs none of this data.
function AuthenticatedProviders({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <>{children}</>
  }

  return (
    <EmployeesProvider>
      <RoutesProvider>
        <VehiclesProvider>
          <CrewsProvider>
            <CrewMembershipsProvider>
              <TransportDaysProvider>
                <TaxiExpensesProvider>
                  <TariffsProvider>
                    <MonthlySheetsProvider>{children}</MonthlySheetsProvider>
                  </TariffsProvider>
                </TaxiExpensesProvider>
              </TransportDaysProvider>
            </CrewMembershipsProvider>
          </CrewsProvider>
        </VehiclesProvider>
      </RoutesProvider>
    </EmployeesProvider>
  )
}
