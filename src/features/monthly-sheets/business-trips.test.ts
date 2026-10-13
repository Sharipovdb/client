import { describe, expect, it } from 'vitest'

import { businessTripsOf } from './business-trips'
import type { MonthlySheetDay } from '@/lib/domain-types'

function aDay(overrides: Partial<MonthlySheetDay> = {}): MonthlySheetDay {
  return {
    transportDayId: 1,
    date: '2026-08-03',
    drivenLegCount: 2,
    drivenKm: 40,
    extraBusinessKm: 0,
    notes: '',
    taxiAmount: 0,
    balance: null,
    ...overrides,
  }
}

describe('businessTripsOf', () => {
  it('lists every day with business kilometres and where they were driven', () => {
    const trips = businessTripsOf([
      aDay({ date: '2026-08-03', extraBusinessKm: 12, notes: 'Bank' }),
      aDay({ date: '2026-08-04' }),
      aDay({ date: '2026-08-05', extraBusinessKm: 8.5, notes: 'Tax office' }),
    ])

    expect(trips).toEqual([
      { date: '2026-08-03', km: 12, notes: 'Bank' },
      { date: '2026-08-05', km: 8.5, notes: 'Tax office' },
    ])
  })

  it('leaves out notes written on a day without business kilometres', () => {
    expect(businessTripsOf([aDay({ notes: 'Rain all day' })])).toEqual([])
  })

  it('keeps a trip logged before notes were required, with no description', () => {
    expect(
      businessTripsOf([aDay({ extraBusinessKm: 5, notes: '  ' })]),
    ).toEqual([{ date: '2026-08-03', km: 5, notes: '' }])
  })
})
