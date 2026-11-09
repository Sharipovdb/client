import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Period } from '@/components/month-picker'
import { MONTHLY_SHEETS_QUERY_KEY } from '@/features/monthly-sheets/monthly-sheets-context'
import { apiClient } from '@/lib/api-client'

/**
 * The money the accountant received for a month and what the crews have cost of it.
 * The backend adds up every sheet's `totalPayout`, top-ups included, and carries what
 * every earlier month left over, so the remainder is never recomputed here.
 */
export interface AccountantBalance {
  year: number
  month: number
  /** `null` until the accountant has entered what they received; it counts as 0. */
  amount: number | null
  /**
   * What earlier months left over, negative when they cost more than was received.
   * Missing from a backend older than the carried balance, which carries nothing.
   */
  carriedAmount?: number
  spentAmount: number
  /**
   * Carried over plus received less spent, carried into the next month with its sign.
   * A backend older than the carried balance answers `null` without an amount.
   */
  remainingAmount: number | null
}

export interface AccountantBalanceEntry extends Period {
  amount: number
}

// Keyed under the sheets so confirming or paying a sheet — or a lead entering their
// top-up — refreshes what is left with everything else. Every month is keyed apart, but
// a later month carries this one, so saving an amount refreshes all of them.
function accountantBalanceKey({ year, month }: Period) {
  return [...MONTHLY_SHEETS_QUERY_KEY, 'accountant-balance', year, month]
}

async function fetchAccountantBalance({ year, month }: Period) {
  const response = await apiClient.get<AccountantBalance>(
    '/api/AccountantBalance/Get',
    { params: { Year: year, Month: month } },
  )

  return response.data
}

export function useAccountantBalance(period: Period) {
  return useQuery({
    queryKey: accountantBalanceKey(period),
    queryFn: () => fetchAccountantBalance(period),
  })
}

export function useSetAccountantBalance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (entry: AccountantBalanceEntry) =>
      apiClient.put('/api/AccountantBalance/Set', entry),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [...MONTHLY_SHEETS_QUERY_KEY, 'accountant-balance'],
      }),
  })
}
