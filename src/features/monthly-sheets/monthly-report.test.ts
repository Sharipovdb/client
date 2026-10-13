import { describe, expect, it } from 'vitest'

import { buildMonthlyReport, hasTravel, startsNewMonth } from './monthly-report'
import type { ReportDay } from './monthly-report'
import type { MonthlySheet, MonthlySheetDay } from '@/lib/domain-types'

// August 2026 starts on a Saturday and has 31 days.
const year = 2026
const month = 8

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

// The totals stand in for what the backend computes, so a sheet built here reads the
// same way one off the wire does.
function aSheet(overrides: Partial<MonthlySheet> = {}): MonthlySheet {
  const days = overrides.days ?? [aDay()]
  // A sheet settles a range; unless a test says otherwise it is the whole month.
  const periodStart = overrides.periodStart ?? '2026-08-01'
  const periodEnd = overrides.periodEnd ?? '2026-08-31'
  const kmRate = overrides.kmRate ?? 0
  const tariffPerLeg = overrides.tariffPerLeg ?? 0
  const amortizationAmount = overrides.amortizationAmount ?? 0
  const totalDrivenKm = days.reduce((sum, day) => sum + day.drivenKm, 0)
  const totalExtraBusinessKm = days.reduce(
    (sum, day) => sum + day.extraBusinessKm,
    0,
  )
  const totalTaxiAmount = days.reduce((sum, day) => sum + day.taxiAmount, 0)
  const totalDrivenLegs = days.reduce((sum, day) => sum + day.drivenLegCount, 0)
  // Exactly as the backend computes it: a tariff buys the commute, so only business
  // travel is left for the index to price. Without one, the index prices everything.
  const isPricedByTariff = tariffPerLeg > 0
  const totalPricedKm = isPricedByTariff
    ? totalExtraBusinessKm
    : totalDrivenKm + totalExtraBusinessKm
  const totalKmAmount = totalPricedKm * kmRate
  const totalTariffAmount = isPricedByTariff
    ? totalDrivenLegs * tariffPerLeg
    : 0
  const totalDrivingAmount = totalKmAmount + totalTariffAmount

  return {
    id: 1,
    crewId: 1,
    year,
    month,
    periodStart,
    periodEnd,
    recipientId: 7,
    recipientFullname: 'Abbos Kamolov',
    isConfirmed: false,
    isPaid: false,
    paidAt: null,
    kmRate,
    openingBalance: null,
    amortizationAmount,
    tariffPerLeg,
    isPricedByTariff,
    totalDrivenKm,
    totalExtraBusinessKm,
    totalTaxiAmount,
    totalPricedKm,
    totalDrivenLegs,
    totalKmAmount,
    totalTariffAmount,
    totalDrivingAmount,
    totalPayable: totalDrivingAmount + totalTaxiAmount + amortizationAmount,
    balance: null,
    ...overrides,
    days,
  }
}

function cellForDate(
  report: ReturnType<typeof buildMonthlyReport>,
  date: string,
) {
  return report.weeks
    .flat()
    .find((cell): cell is ReportDay => cell?.date === date)
}

function cellFor(
  report: ReturnType<typeof buildMonthlyReport>,
  dayOfMonth: number,
) {
  return report.weeks
    .flat()
    .find((cell): cell is ReportDay => cell?.dayOfMonth === dayOfMonth)
}

describe('buildMonthlyReport', () => {
  it('lays the month out Monday-first, padding the days before the 1st', () => {
    const report = buildMonthlyReport(aSheet(), 'Crew A')

    // 1 August 2026 is a Saturday: five blank cells precede it.
    expect(report.weeks[0].slice(0, 5)).toEqual([null, null, null, null, null])
    expect(report.weeks[0][5]).toMatchObject({ dayOfMonth: 1 })
  })

  it('gives every week seven cells', () => {
    const report = buildMonthlyReport(aSheet(), 'Crew A')

    expect(report.weeks.every((week) => week.length === 7)).toBe(true)
  })

  it('covers every day of the month exactly once', () => {
    const report = buildMonthlyReport(aSheet(), 'Crew A')
    const dayNumbers = report.weeks
      .flat()
      .filter(Boolean)
      .map((cell) => cell!.dayOfMonth)

    expect(dayNumbers).toEqual(
      Array.from({ length: 31 }, (_, index) => index + 1),
    )
  })

  it('marks a driven day with its round-trip distance', () => {
    const report = buildMonthlyReport(
      aSheet({ days: [aDay({ date: '2026-08-12', drivenKm: 40 })] }),
      'Crew A',
    )

    expect(cellFor(report, 12)).toMatchObject({ drivenKm: 40, taxiAmount: 0 })
  })

  it('marks a taxi day with its fare and no distance', () => {
    const report = buildMonthlyReport(
      aSheet({
        days: [aDay({ date: '2026-08-12', drivenKm: 0, taxiAmount: 55 })],
      }),
      'Crew A',
    )

    expect(cellFor(report, 12)).toMatchObject({ drivenKm: 0, taxiAmount: 55 })
  })

  it('leaves a day with no logged travel unmarked', () => {
    const report = buildMonthlyReport(
      aSheet({ days: [aDay({ date: '2026-08-12' })] }),
      'Crew A',
    )

    expect(hasTravel(cellFor(report, 13)!)).toBe(false)
    expect(hasTravel(cellFor(report, 12)!)).toBe(true)
  })

  it('reads the day off the ISO date rather than a local Date', () => {
    // A Date-based reading shifts 1 August back to 31 July west of UTC.
    const report = buildMonthlyReport(
      aSheet({ days: [aDay({ date: '2026-08-01' })] }),
      'Crew A',
    )

    expect(hasTravel(cellFor(report, 1)!)).toBe(true)
    expect(report.travelledDayCount).toBe(1)
  })

  it('takes its totals from the sheet instead of recomputing them', () => {
    const report = buildMonthlyReport(
      aSheet({
        days: [
          aDay({ date: '2026-08-03', drivenKm: 40, extraBusinessKm: 6 }),
          aDay({
            transportDayId: 2,
            date: '2026-08-04',
            drivenKm: 0,
            taxiAmount: 55,
          }),
        ],
      }),
      'Crew A',
    )

    expect(report).toMatchObject({
      travelledDayCount: 2,
      totalDrivenKm: 40,
      totalExtraBusinessKm: 6,
      totalTaxiAmount: 55,
    })
  })

  it('carries the priced kilometres and the one amount payable', () => {
    const report = buildMonthlyReport(
      aSheet({
        kmRate: 1.5,
        amortizationAmount: 500,
        days: [
          aDay({ date: '2026-08-03', drivenKm: 40, extraBusinessKm: 10 }),
          aDay({
            transportDayId: 2,
            date: '2026-08-04',
            drivenKm: 0,
            taxiAmount: 55,
          }),
        ],
      }),
      'Crew A',
    )

    expect(report).toMatchObject({
      kmRate: 1.5,
      totalPricedKm: 50,
      totalKmAmount: 75,
      amortizationAmount: 500,
      // 75 for the distance, 55 in fares, 500 for the car.
      totalPayable: 630,
    })
  })

  it('reads the money off the sheet rather than multiplying it again', () => {
    // The backend rounds the priced distance to the cent; recomputing it here would
    // eventually disagree with the sheet that was actually paid.
    const report = buildMonthlyReport(
      aSheet({ kmRate: 1.5, totalKmAmount: 12.34, totalPayable: 99.99 }),
      'Crew A',
    )

    expect(report).toMatchObject({ totalKmAmount: 12.34, totalPayable: 99.99 })
  })

  it('still prices a tariffed crew business travel by the kilometre', () => {
    const report = buildMonthlyReport(
      aSheet({
        tariffPerLeg: 30,
        kmRate: 2,
        days: [
          aDay({
            date: '2026-08-03',
            drivenLegCount: 2,
            drivenKm: 40,
            extraBusinessKm: 12,
          }),
        ],
      }),
      'Crew A',
    )

    expect(report).toMatchObject({
      totalTariffAmount: 60,
      // Only the business kilometres reach the index; the 40 commute km do not.
      totalPricedKm: 12,
      totalKmAmount: 24,
      totalPayable: 84,
    })
  })

  it('prices a crew on a tariff by the leg and leaves its commute unmeasured', () => {
    const report = buildMonthlyReport(
      aSheet({
        tariffPerLeg: 30,
        kmRate: 99, // ignored: the tariff is what this crew is settled at
        days: [
          aDay({ date: '2026-08-03', drivenLegCount: 2, drivenKm: 40 }),
          aDay({
            transportDayId: 2,
            date: '2026-08-04',
            drivenLegCount: 1,
            drivenKm: 20,
            taxiAmount: 15,
          }),
        ],
      }),
      'Crew A',
    )

    expect(report).toMatchObject({
      isPricedByTariff: true,
      tariffPerLeg: 30,
      totalDrivenLegs: 3,
      totalTariffAmount: 90,
      totalKmAmount: 0,
      // 90 for the three legs, 15 in fares.
      totalPayable: 105,
    })
  })

  it('still reports the distance a tariffed crew actually drove', () => {
    // The kilometres are not paid for, but the report must still show the journey.
    const report = buildMonthlyReport(
      aSheet({
        tariffPerLeg: 30,
        days: [aDay({ drivenLegCount: 2, drivenKm: 40 })],
      }),
      'Crew A',
    )

    expect(report.totalDrivenKm).toBe(40)
  })

  it('leaves a crew without a tariff priced by the kilometre', () => {
    const report = buildMonthlyReport(
      aSheet({ kmRate: 2, days: [aDay({ drivenLegCount: 2, drivenKm: 40 })] }),
      'Crew A',
    )

    expect(report).toMatchObject({
      isPricedByTariff: false,
      totalTariffAmount: 0,
      totalKmAmount: 80,
      totalPayable: 80,
    })
  })

  it('marks a driven day as travelled even where the route measures zero km', () => {
    // A tariffed crew earns by the leg, so a leg counts as travel on its own.
    const report = buildMonthlyReport(
      aSheet({
        tariffPerLeg: 30,
        days: [aDay({ date: '2026-08-12', drivenLegCount: 2, drivenKm: 0 })],
      }),
      'Crew A',
    )

    expect(hasTravel(cellFor(report, 12)!)).toBe(true)
  })

  it('lays out the period it settles, not the month it is named for', () => {
    // July was closed on the 27th, so August's sheet owes the four days July left behind
    // and its calendar has to start there.
    const report = buildMonthlyReport(
      aSheet({
        periodStart: '2026-07-28',
        periodEnd: '2026-08-31',
        days: [aDay({ date: '2026-07-29' })],
      }),
      'Crew A',
    )

    const cells = report.weeks.flat().filter(Boolean)

    expect(cells[0]!.date).toBe('2026-07-28')
    expect(cells[cells.length - 1]!.date).toBe('2026-08-31')
  })

  it('marks travel on a carried-over day from the previous month', () => {
    const report = buildMonthlyReport(
      aSheet({
        periodStart: '2026-07-28',
        periodEnd: '2026-08-31',
        days: [aDay({ date: '2026-07-29', drivenKm: 40 })],
      }),
      'Crew A',
    )

    expect(hasTravel(cellForDate(report, '2026-07-29')!)).toBe(true)
    // The 29th of August is a different day and must not inherit that travel.
    expect(hasTravel(cellForDate(report, '2026-08-29')!)).toBe(false)
  })

  it('flags the first of a month so a two-month period stays readable', () => {
    const report = buildMonthlyReport(
      aSheet({ periodStart: '2026-07-28', periodEnd: '2026-08-31' }),
      'Crew A',
    )

    expect(startsNewMonth(cellForDate(report, '2026-08-01')!)).toBe(true)
    expect(startsNewMonth(cellForDate(report, '2026-07-29')!)).toBe(false)
  })

  it('stops at the closing date when a month is settled early', () => {
    const report = buildMonthlyReport(
      aSheet({ periodStart: '2026-08-01', periodEnd: '2026-08-27' }),
      'Crew A',
    )

    const cells = report.weeks.flat().filter(Boolean)

    expect(cells[cells.length - 1]!.date).toBe('2026-08-27')
    expect(cellForDate(report, '2026-08-28')).toBeUndefined()
  })

  it('carries the crew, the lead being paid, and the settlement state', () => {
    const report = buildMonthlyReport(
      aSheet({ isConfirmed: true, isPaid: true }),
      'Crew A',
    )

    expect(report).toMatchObject({
      crewName: 'Crew A',
      recipientFullname: 'Abbos Kamolov',
      isConfirmed: true,
      isPaid: true,
    })
  })

  it('carries the opening balance and what is left of it after the month', () => {
    const report = buildMonthlyReport(
      aSheet({ openingBalance: 100, balance: -15, totalPayable: 15 }),
      'Crew A',
    )

    expect(report).toMatchObject({
      openingBalance: 100,
      balance: -15,
      totalPayable: 15,
    })
  })

  it('shows on each travelled day what is left of the opening balance', () => {
    const report = buildMonthlyReport(
      aSheet({
        openingBalance: 100,
        days: [
          aDay({ date: '2026-08-03', balance: 50 }),
          aDay({ date: '2026-08-04', balance: -15 }),
        ],
      }),
      'Crew A',
    )

    expect(cellForDate(report, '2026-08-03')?.balance).toBe(50)
    expect(cellForDate(report, '2026-08-04')?.balance).toBe(-15)
    expect(cellForDate(report, '2026-08-05')?.balance).toBeNull()
  })

  it('has no balance for a lead settled at the end of the month', () => {
    const report = buildMonthlyReport(aSheet(), 'Crew A')

    expect(report).toMatchObject({ openingBalance: null, balance: null })
  })
})
