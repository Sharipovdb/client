import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'

import { apiClient } from '@/lib/api-client'
import type { MonthlySheet } from '@/lib/domain-types'
import { nestedLargePage } from '@/lib/pagination'

// The API shape matches MonthlyTransportSheetDto one-to-one; only the date is narrowed
// to the yyyy-mm-dd the rest of the app uses.
interface MonthlySheetDayApiDto {
  transportDayId: number
  date: string
  drivenLegCount: number
  drivenKm: number
  extraBusinessKm: number
  notes: string
  taxiAmount: number
  balance: number | null
}

interface MonthlySheetApiDto {
  id: number
  crewId: number
  year: number
  month: number
  periodStart: string
  periodEnd: string
  recipientId: number
  recipientFullname: string
  isConfirmed: boolean
  isPaid: boolean
  paidAt: string | null
  kmRate: number
  openingBalance: number | null
  amortizationAmount: number
  tariffPerLeg: number
  isPricedByTariff: boolean
  days: MonthlySheetDayApiDto[]
  totalDrivenKm: number
  totalExtraBusinessKm: number
  totalTaxiAmount: number
  totalPricedKm: number
  totalDrivenLegs: number
  totalKmAmount: number
  totalTariffAmount: number
  totalDrivingAmount: number
  totalPayable: number
  balance: number | null
}

interface PaginatedResult<T> {
  items: T[]
  totalCount: number
}

const MONTHLY_SHEETS_QUERY_KEY = ['monthly-sheets']

function toMonthlySheet(dto: MonthlySheetApiDto): MonthlySheet {
  return {
    ...dto,
    periodStart: dto.periodStart.slice(0, 10),
    periodEnd: dto.periodEnd.slice(0, 10),
    days: dto.days.map((day) => ({ ...day, date: day.date.slice(0, 10) })),
  }
}

export interface SheetPeriod {
  crewId: number
  year: number
  month: number
}

/**
 * A period plus the index its kilometres are priced with. The rate is the one figure
 * the backend cannot derive from the log, so it travels with every request that prices
 * a month — and the server, not this client, does the multiplying.
 */
export interface PricedSheetPeriod extends SheetPeriod {
  kmRate: number
  /**
   * What the lead was handed at the start of the month. `null` settles the month in
   * arrears; a number has each day's trips and fares taken off it instead.
   */
  openingBalance: number | null
  /**
   * The day the accountant is closing on, as ISO yyyy-mm-dd. `null` settles the whole
   * month. An earlier date settles a short period and leaves the remaining days to the
   * next sheet, which is how a payout on the 27th stops swallowing the rest of August.
   */
  periodEnd: string | null
}

async function fetchSheets() {
  const response = await apiClient.get<PaginatedResult<MonthlySheetApiDto>>(
    '/api/MonthlyTransportSheets/GetAll',
    { params: nestedLargePage },
  )

  return response.data.items.map(toMonthlySheet)
}

async function fetchPreview(period: PricedSheetPeriod) {
  const response = await apiClient.post<MonthlySheetApiDto>(
    '/api/MonthlyTransportSheets/GetPreview',
    period,
  )

  return toMonthlySheet(response.data)
}

/**
 * What generating this period would produce, computed server-side and saved nowhere.
 * Passing `null` disables it — a month that already has a saved sheet reads that sheet
 * instead, and the record must never be second-guessed by a recalculation.
 *
 * It is keyed under the sheets key so generating, confirming or deleting a sheet
 * refreshes the preview with everything else. The index is part of the key: changing it
 * is a different month's worth of money and has to be recomputed.
 */
export function useMonthlySheetPreview(period: PricedSheetPeriod | null) {
  return useQuery({
    queryKey: [...MONTHLY_SHEETS_QUERY_KEY, 'preview', period],
    queryFn: () => fetchPreview(period!),
    enabled: period !== null,
    retry: false,
  })
}

interface MonthlySheetsContextValue {
  sheets: MonthlySheet[]
  isLoading: boolean
  getSheet: (period: SheetPeriod) => MonthlySheet | undefined
  generateSheet: (period: PricedSheetPeriod) => Promise<MonthlySheet>
  setOpeningBalance: (
    sheetId: number,
    openingBalance: number | null,
  ) => Promise<void>
  confirmSheet: (sheetId: number) => Promise<void>
  unconfirmSheet: (sheetId: number) => Promise<void>
  markSheetPaid: (sheetId: number) => Promise<void>
  deleteSheet: (sheetId: number) => Promise<void>
}

const MonthlySheetsContext = createContext<MonthlySheetsContextValue | null>(
  null,
)

function isSamePeriod(sheet: MonthlySheet, period: SheetPeriod) {
  return (
    sheet.crewId === period.crewId &&
    sheet.year === period.year &&
    sheet.month === period.month
  )
}

export function MonthlySheetsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data: sheets = [], isLoading } = useQuery({
    queryKey: MONTHLY_SHEETS_QUERY_KEY,
    queryFn: fetchSheets,
  })

  // Paying a sheet moves the taxi fares behind it on to Paid, so the expense list is
  // stale afterwards too.
  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: MONTHLY_SHEETS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['taxi-expenses'] }),
    ])
  }

  const generateMutation = useMutation({
    mutationFn: async (period: PricedSheetPeriod) => {
      const response = await apiClient.post<MonthlySheetApiDto>(
        '/api/MonthlyTransportSheets/Generate',
        period,
      )

      return toMonthlySheet(response.data)
    },
    onSuccess: invalidate,
  })

  // A lead enters their advance on a draft without repricing it: the index and the
  // closing date stay exactly as the accountant saved them.
  const openingBalanceMutation = useMutation({
    mutationFn: ({
      sheetId,
      openingBalance,
    }: {
      sheetId: number
      openingBalance: number | null
    }) =>
      apiClient.put(
        `/api/MonthlyTransportSheets/SetOpeningBalance/${sheetId}`,
        {
          openingBalance,
        },
      ),
    onSuccess: invalidate,
  })

  const confirmMutation = useMutation({
    mutationFn: (sheetId: number) =>
      apiClient.put(`/api/MonthlyTransportSheets/Confirm/${sheetId}`),
    onSuccess: invalidate,
  })

  // Confirming is reversible right up to payment, so the month can be reopened, fixed
  // and confirmed again instead of being deleted and rebuilt from scratch.
  const unconfirmMutation = useMutation({
    mutationFn: (sheetId: number) =>
      apiClient.put(`/api/MonthlyTransportSheets/Unconfirm/${sheetId}`),
    onSuccess: invalidate,
  })

  // Settling a crew closes its month; the backend refuses a second call, so the
  // refetched sheet is the source of truth for the button's state.
  const markPaidMutation = useMutation({
    mutationFn: (sheetId: number) =>
      apiClient.put(`/api/MonthlyTransportSheets/MarkPaid/${sheetId}`),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (sheetId: number) =>
      apiClient.delete(`/api/MonthlyTransportSheets/Delete/${sheetId}`),
    onSuccess: invalidate,
  })

  const value = useMemo<MonthlySheetsContextValue>(
    () => ({
      sheets,
      isLoading,
      getSheet: (period) => sheets.find((sheet) => isSamePeriod(sheet, period)),
      generateSheet: (period) => generateMutation.mutateAsync(period),
      setOpeningBalance: async (sheetId, openingBalance) => {
        await openingBalanceMutation.mutateAsync({ sheetId, openingBalance })
      },
      confirmSheet: async (sheetId) => {
        await confirmMutation.mutateAsync(sheetId)
      },
      unconfirmSheet: async (sheetId) => {
        await unconfirmMutation.mutateAsync(sheetId)
      },
      markSheetPaid: async (sheetId) => {
        await markPaidMutation.mutateAsync(sheetId)
      },
      deleteSheet: async (sheetId) => {
        await deleteMutation.mutateAsync(sheetId)
      },
    }),
    [
      sheets,
      isLoading,
      generateMutation,
      openingBalanceMutation,
      confirmMutation,
      unconfirmMutation,
      markPaidMutation,
      deleteMutation,
    ],
  )

  return (
    <MonthlySheetsContext.Provider value={value}>
      {children}
    </MonthlySheetsContext.Provider>
  )
}

export function useMonthlySheets() {
  const context = useContext(MonthlySheetsContext)

  if (!context) {
    throw new Error(
      'useMonthlySheets must be used inside MonthlySheetsProvider',
    )
  }

  return context
}
