import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'

import { apiClient } from '@/lib/api-client'
import type { Tariff } from '@/lib/domain-types'
import { flatLargePage } from '@/lib/pagination'

// The API shape matches TariffDto one-to-one.
interface TariffApiDto {
  id: number
  name: string
  amountPerLeg: number
}

interface PaginatedResult<T> {
  items: T[]
  totalCount: number
}

export interface TariffDraft {
  name: string
  amountPerLeg: number
}

const TARIFFS_QUERY_KEY = ['tariffs']

async function fetchTariffs() {
  const response = await apiClient.get<PaginatedResult<TariffApiDto>>(
    '/api/Tariff/GetAll',
    { params: flatLargePage },
  )

  return response.data.items
}

interface TariffsContextValue {
  tariffs: Tariff[]
  isLoading: boolean
  /** The price a crew was put on, or `undefined` when it is measured by distance. */
  getTariffById: (tariffId: number | null | undefined) => Tariff | undefined
  addTariff: (draft: TariffDraft) => Promise<void>
  updateTariff: (tariffId: number, draft: TariffDraft) => Promise<void>
  deleteTariff: (tariffId: number) => Promise<void>
}

const TariffsContext = createContext<TariffsContextValue | null>(null)

export function TariffsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data: tariffs = [], isLoading } = useQuery({
    queryKey: TARIFFS_QUERY_KEY,
    queryFn: fetchTariffs,
  })

  // Repricing a tariff changes what every crew on it is owed, so the monthly sheet
  // previews are stale alongside the catalogue itself.
  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: TARIFFS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['monthly-sheets'] }),
    ])
  }

  const addMutation = useMutation({
    mutationFn: (draft: TariffDraft) =>
      apiClient.post('/api/Tariff/Create', draft),
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: ({
      tariffId,
      draft,
    }: {
      tariffId: number
      draft: TariffDraft
    }) => apiClient.put(`/api/Tariff/Update/${tariffId}`, draft),
    onSuccess: invalidate,
  })

  // Withdrawing a price crews are still on is refused server-side, so the list stays the
  // source of truth for whether it worked.
  const deleteMutation = useMutation({
    mutationFn: (tariffId: number) =>
      apiClient.delete(`/api/Tariff/Delete/${tariffId}`),
    onSuccess: invalidate,
  })

  const value = useMemo<TariffsContextValue>(
    () => ({
      tariffs,
      isLoading,
      getTariffById: (tariffId) =>
        tariffId === null || tariffId === undefined
          ? undefined
          : tariffs.find((tariff) => tariff.id === tariffId),
      addTariff: async (draft) => {
        await addMutation.mutateAsync(draft)
      },
      updateTariff: async (tariffId, draft) => {
        await updateMutation.mutateAsync({ tariffId, draft })
      },
      deleteTariff: async (tariffId) => {
        await deleteMutation.mutateAsync(tariffId)
      },
    }),
    [tariffs, isLoading, addMutation, updateMutation, deleteMutation],
  )

  return (
    <TariffsContext.Provider value={value}>{children}</TariffsContext.Provider>
  )
}

export function useTariffs() {
  const context = useContext(TariffsContext)

  if (!context) {
    throw new Error('useTariffs must be used inside TariffsProvider')
  }

  return context
}
