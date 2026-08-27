import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'

import { apiClient } from '@/lib/api-client'
import { flatLargePage } from '@/lib/pagination'
import type { Vehicle } from '@/lib/domain-types'

interface VehicleApiDto {
  id: number
  driverId: number
  plate: string
  seatCount: number
  amortizationBasis: number
}

interface PaginatedResult<T> {
  items: T[]
  totalCount: number
}

export interface VehicleDraft {
  driverId: number
  plate: string
  seatCount: number
  amortizationBasis: number
}

const VEHICLES_QUERY_KEY = ['vehicles']

function toVehicle(dto: VehicleApiDto): Vehicle {
  return {
    id: Number(dto.id),
    driverId: Number(dto.driverId),
    plate: dto.plate,
    seatCount: dto.seatCount,
    amortizationBasis: dto.amortizationBasis,
  }
}

async function fetchVehicles() {
  const response = await apiClient.get<PaginatedResult<VehicleApiDto>>(
    '/api/Vehicle/GetAll',
    {
      params: flatLargePage,
    },
  )

  return response.data.items.map(toVehicle)
}

interface VehiclesContextValue {
  vehicles: Vehicle[]
  isLoading: boolean
  addVehicle: (draft: VehicleDraft) => Promise<void>
  updateVehicle: (vehicleId: number, draft: VehicleDraft) => Promise<void>
  deleteVehicle: (vehicleId: number) => Promise<void>
  getVehicleById: (vehicleId: number | null | undefined) => Vehicle | undefined
  getVehicleByDriverId: (
    driverId: number | null | undefined,
  ) => Vehicle | undefined
}

const VehiclesContext = createContext<VehiclesContextValue | null>(null)

export function VehiclesProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: VEHICLES_QUERY_KEY,
    queryFn: fetchVehicles,
  })

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY })
  }

  const addMutation = useMutation({
    mutationFn: (draft: VehicleDraft) =>
      apiClient.post('/api/Vehicle/Create', {
        driverId: Number(draft.driverId),
        plate: draft.plate,
        seatCount: draft.seatCount,
        amortizationBasis: draft.amortizationBasis,
      }),
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    // UpdateVehicleRequest is the one backend DTO with snake_case JSON keys — kept
    // isolated to this single call rather than fixing the backend for a cosmetic quirk.
    mutationFn: ({
      vehicleId,
      draft,
    }: {
      vehicleId: number
      draft: VehicleDraft
    }) =>
      apiClient.put(`/api/Vehicle/Update/${vehicleId}`, {
        driver_id: Number(draft.driverId),
        plate: draft.plate,
        seat_count: draft.seatCount,
        amortization_basis: draft.amortizationBasis,
      }),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (vehicleId: number) =>
      apiClient.delete(`/api/Vehicle/Delete/${vehicleId}`),
    onSuccess: invalidate,
  })

  const value = useMemo<VehiclesContextValue>(
    () => ({
      vehicles,
      isLoading,
      addVehicle: async (draft) => {
        await addMutation.mutateAsync(draft)
      },
      updateVehicle: async (vehicleId, draft) => {
        await updateMutation.mutateAsync({ vehicleId, draft })
      },
      deleteVehicle: async (vehicleId) => {
        await deleteMutation.mutateAsync(vehicleId)
      },
      getVehicleById: (vehicleId) =>
        vehicles.find((vehicle) => vehicle.id === vehicleId),
      getVehicleByDriverId: (driverId) =>
        vehicles.find((vehicle) => vehicle.driverId === driverId),
    }),
    [vehicles, isLoading, addMutation, updateMutation, deleteMutation],
  )

  return (
    <VehiclesContext.Provider value={value}>
      {children}
    </VehiclesContext.Provider>
  )
}

export function useVehicles() {
  const context = useContext(VehiclesContext)

  if (!context) {
    throw new Error('useVehicles must be used inside VehiclesProvider')
  }

  return context
}
