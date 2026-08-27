import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'

import { apiClient } from '@/lib/api-client'
import type { Leg, TaxiExpense, TaxiExpenseStatus } from '@/lib/domain-types'
import { nestedLargePage } from '@/lib/pagination'

// The list/detail DTO gives back each enum's own PascalCase name, which already matches
// these unions, so no conversion is needed on the read side.
interface TaxiExpenseApiDto {
  id: number
  transportDayId: number
  paidById: number
  leg: Leg
  amount: number
  taxiExpenseStatus: TaxiExpenseStatus
}

interface PaginatedResult<T> {
  items: T[]
  totalCount: number
}

// What may be corrected on a fare that has not been ruled on yet. The leg and the day
// are not among them: which legs were taken by taxi is what the transport day says.
// paidById stays a string here — it comes straight from a <select> element's raw form
// value and is only turned into a number at the API boundary, in toApiPayload.
export interface TaxiExpenseDraft {
  amount: number
  paidById: string
}

const TAXI_EXPENSES_QUERY_KEY = ['taxi-expenses']

function toTaxiExpense(dto: TaxiExpenseApiDto): TaxiExpense {
  return {
    id: dto.id,
    transportDayId: dto.transportDayId,
    leg: dto.leg,
    amount: dto.amount,
    paidById: dto.paidById,
    taxiExpenseStatus: dto.taxiExpenseStatus,
  }
}

async function fetchTaxiExpenses() {
  const response = await apiClient.get<PaginatedResult<TaxiExpenseApiDto>>('/api/TaxiExpense/GetAll', {
    params: nestedLargePage,
  })

  return response.data.items.map(toTaxiExpense)
}

function toApiPayload(draft: TaxiExpenseDraft) {
  return {
    amount: draft.amount,
    paidById: Number(draft.paidById),
  }
}

// Neither creating nor deleting an expense is part of this contract, on purpose: a taxi
// ride is recorded on the transport day it belongs to (see features/transport-days),
// which is what keeps a taxi leg from ever existing without a fare behind it — or a fare
// without a ride. A fare the company will not pay is rejected, not deleted.
interface TaxiExpensesContextValue {
  taxiExpenses: TaxiExpense[]
  isLoading: boolean
  getExpensesForDay: (transportDayId: number) => TaxiExpense[]
  updateTaxiExpense: (expenseId: number, draft: TaxiExpenseDraft) => Promise<void>
  approveTaxiExpense: (expenseId: number) => Promise<void>
  rejectTaxiExpense: (expenseId: number) => Promise<void>
}

const TaxiExpensesContext = createContext<TaxiExpensesContextValue | null>(null)

export function TaxiExpensesProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data: taxiExpenses = [], isLoading } = useQuery({
    queryKey: TAXI_EXPENSES_QUERY_KEY,
    queryFn: fetchTaxiExpenses,
  })

  // An expense belongs to a transport day and feeds a monthly sheet, so changing one
  // invalidates all three views rather than leaving the other two showing stale money.
  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: TAXI_EXPENSES_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['transport-days'] }),
      queryClient.invalidateQueries({ queryKey: ['monthly-sheets'] }),
    ])
  }

  const updateMutation = useMutation({
    // UpdateTaxiExpenseRequest is bound [FromQuery] on the backend despite being a
    // PUT — send the full payload as query params, not a JSON body.
    mutationFn: ({ expenseId, draft }: { expenseId: number; draft: TaxiExpenseDraft }) =>
      apiClient.put(`/api/TaxiExpense/Update/${expenseId}`, undefined, { params: toApiPayload(draft) }),
    onSuccess: invalidate,
  })

  const approveMutation = useMutation({
    mutationFn: (expenseId: number) => apiClient.put(`/api/TaxiExpense/Approve/${expenseId}`),
    onSuccess: invalidate,
  })

  const rejectMutation = useMutation({
    mutationFn: (expenseId: number) => apiClient.put(`/api/TaxiExpense/Reject/${expenseId}`),
    onSuccess: invalidate,
  })

  const value = useMemo<TaxiExpensesContextValue>(
    () => ({
      taxiExpenses,
      isLoading,
      getExpensesForDay: (transportDayId) =>
        taxiExpenses.filter((expense) => expense.transportDayId === transportDayId),
      updateTaxiExpense: async (expenseId, draft) => { await updateMutation.mutateAsync({ expenseId, draft }) },
      approveTaxiExpense: async (expenseId) => { await approveMutation.mutateAsync(expenseId) },
      rejectTaxiExpense: async (expenseId) => { await rejectMutation.mutateAsync(expenseId) },
    }),
    [taxiExpenses, isLoading, updateMutation, approveMutation, rejectMutation],
  )

  return <TaxiExpensesContext.Provider value={value}>{children}</TaxiExpensesContext.Provider>
}

export function useTaxiExpenses() {
  const context = useContext(TaxiExpensesContext)

  if (!context) {
    throw new Error('useTaxiExpenses must be used inside TaxiExpensesProvider')
  }

  return context
}
