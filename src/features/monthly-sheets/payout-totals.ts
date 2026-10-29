import type { MonthlySheet } from '@/lib/domain-types'

export interface PayoutTotals {
  /** What the month's crews cost, the advances handed out at its start included. */
  totalPayout: number
  /** What is left to release: unpaid sheets only, and never the advances already handed. */
  stillToPay: number
}

export function payoutTotals(sheets: MonthlySheet[]): PayoutTotals {
  return sheets.reduce<PayoutTotals>(
    (totals, sheet) => ({
      totalPayout: totals.totalPayout + sheet.totalPayout,
      stillToPay: sheet.isPaid
        ? totals.stillToPay
        : totals.stillToPay + sheet.totalPayable,
    }),
    { totalPayout: 0, stillToPay: 0 },
  )
}
