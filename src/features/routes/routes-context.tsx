import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'

import { apiClient } from '@/lib/api-client'
import { nestedLargePage } from '@/lib/pagination'
import type { TransportRoute } from '@/lib/domain-types'

interface RouteApiDto {
  id: number
  name: string
  distanceKm: number
}

interface PaginatedResult<T> {
  items: T[]
  totalCount: number
}

export interface TransportRouteDraft {
  name: string
  distanceKm: number
}

const ROUTES_QUERY_KEY = ['routes']

function toRoute(dto: RouteApiDto): TransportRoute {
  return { id: dto.id, name: dto.name, distanceKm: dto.distanceKm }
}

async function fetchRoutes() {
  const response = await apiClient.get<PaginatedResult<RouteApiDto>>(
    '/api/Route/GetAll',
    {
      params: nestedLargePage,
    },
  )

  return response.data.items.map(toRoute)
}

interface RoutesContextValue {
  routes: TransportRoute[]
  isLoading: boolean
  addRoute: (draft: TransportRouteDraft) => Promise<void>
  updateRoute: (routeId: number, draft: TransportRouteDraft) => Promise<void>
  deleteRoute: (routeId: number) => Promise<void>
  getRouteById: (
    routeId: number | null | undefined,
  ) => TransportRoute | undefined
}

const RoutesContext = createContext<RoutesContextValue | null>(null)

export function RoutesProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ROUTES_QUERY_KEY,
    queryFn: fetchRoutes,
  })

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ROUTES_QUERY_KEY })
  }

  const addMutation = useMutation({
    mutationFn: (draft: TransportRouteDraft) =>
      apiClient.post('/api/Route/Add', draft),
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: ({
      routeId,
      draft,
    }: {
      routeId: number
      draft: TransportRouteDraft
    }) => apiClient.put('/api/Route/Update', { id: Number(routeId), ...draft }),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (routeId: number) =>
      apiClient.delete(`/api/Route/Delete/${routeId}`),
    onSuccess: invalidate,
  })

  const value = useMemo<RoutesContextValue>(
    () => ({
      routes,
      isLoading,
      addRoute: async (draft) => {
        await addMutation.mutateAsync(draft)
      },
      updateRoute: async (routeId, draft) => {
        await updateMutation.mutateAsync({ routeId, draft })
      },
      deleteRoute: async (routeId) => {
        await deleteMutation.mutateAsync(routeId)
      },
      getRouteById: (routeId) => routes.find((route) => route.id === routeId),
    }),
    [routes, isLoading, addMutation, updateMutation, deleteMutation],
  )

  return (
    <RoutesContext.Provider value={value}>{children}</RoutesContext.Provider>
  )
}

export function useTransportRoutes() {
  const context = useContext(RoutesContext)

  if (!context) {
    throw new Error('useTransportRoutes must be used inside RoutesProvider')
  }

  return context
}
