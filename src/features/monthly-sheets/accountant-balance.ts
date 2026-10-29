import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Period } from '@/components/month-picker'
import { MONTHLY_SHEETS_QUERY_KEY } from '@/features/monthly-sheets/monthly-sheets-context'
import { apiClient } from '@/lib/api-client'

/**
 * The money the accountant received for a month and what the crews have cost of it.
 * The backend adds up every sheet's `totalPayout`, advances included, so the remainder
 * is never recomputed here.
 */
export interface AccountantBalance {
  year: number
  month: number
  /** `null` until the accountant has entered what they received. */
  amount: number | null
  spentAmount: number
  /** Negative once the crews cost more than was received; `null` without an amount. */
  remainingAmount: number | null
}

export interface AccountantBalanceEntry extends Period {
  amount: number
}

// Keyed under the sheets so generating, confirming, paying or deleting a sheet — or a
// lead entering their advance — refreshes what is left with everything else.
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
    onSuccess: (_, entry) =>
      queryClient.invalidateQueries({ queryKey: accountantBalanceKey(entry) }),
  })
}
