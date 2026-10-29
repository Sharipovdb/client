import { describe, expect, it } from 'vitest'

import { payoutTotals } from './payout-totals'
import type { MonthlySheet } from '@/lib/domain-types'

function aSheet(
  overrides: Pick<MonthlySheet, 'totalPayable' | 'totalPayout'> &
    Partial<MonthlySheet>,
) {
  return { isPaid: false, ...overrides } as MonthlySheet
}

describe('payoutTotals', () => {
  it('counts every opening balance into the month payout', () => {
    const totals = payoutTotals([
      aSheet({ openingBalance: 500, totalPayable: 0, totalPayout: 500 }),
      aSheet({ openingBalance: null, totalPayable: 120.5, totalPayout: 120.5 }),
    ])

    expect(totals.totalPayout).toBe(620.5)
  })

  it('leaves the advances and the paid sheets out of what is still to pay', () => {
    const totals = payoutTotals([
      aSheet({ openingBalance: 500, totalPayable: 80, totalPayout: 580 }),
      aSheet({ isPaid: true, totalPayable: 200, totalPayout: 200 }),
    ])

    expect(totals.stillToPay).toBe(80)
  })

  it('adds up to nothing for a month without sheets', () => {
    expect(payoutTotals([])).toEqual({ totalPayout: 0, stillToPay: 0 })
  })
})
