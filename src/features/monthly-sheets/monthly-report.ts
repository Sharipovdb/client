import type { MonthlySheet, MonthlySheetDay } from '@/lib/domain-types'

/**
 * Lays a crew's settlement out as a calendar.
 *
 * The sheet already carries the figures — including the money its driving is worth and
 * the amount finally payable — so this only arranges its days into weeks. The printed
 * report and the screen then show the same numbers rather than two calculations that can
 * drift apart. One marked cell is one working day: what the crew's own driving was worth,
 * the taxi fare it cost, or both when it drove one leg and taxied the other.
 *
 * The grid spans the period the sheet actually settles, not a calendar month. A month
 * closed early ends on its closing date, and the next sheet picks up the day after — so a
 * settlement can begin in one month and end in the next, and the calendar has to show
 * that rather than hide it.
 */

export interface ReportDay {
  /** ISO yyyy-mm-dd. The identity of the cell: a period can span two months. */
  date: string
  dayOfMonth: number
  drivenLegCount: number
  drivenKm: number
  extraBusinessKm: number
  taxiAmount: number
}

/** `null` pads the leading and trailing cells of a week that fall outside the period. */
export type ReportWeek = (ReportDay | null)[]

export interface MonthlyReport {
  crewName: string
  recipientFullname: string
  year: number
  month: number
  /** The days actually settled, inclusive. */
  periodStart: string
  periodEnd: string
  isConfirmed: boolean
  isPaid: boolean
  weeks: ReportWeek[]
  travelledDayCount: number
  totalDrivenKm: number
  totalExtraBusinessKm: number
  totalTaxiAmount: number
  /** TJS per kilometre, as entered on the sheet. Unused when the crew is on a tariff. */
  kmRate: number
  totalPricedKm: number
  totalKmAmount: number
  /** Set when the crew is settled per trip rather than per kilometre. */
  isPricedByTariff: boolean
  tariffPerLeg: number
  totalDrivenLegs: number
  totalTariffAmount: number
  /** What the crew's own driving is worth, whichever way it was priced. */
  totalDrivingAmount: number
  amortizationAmount: number
  /** Kilometres, fares and the car allowance as the one amount the lead is handed. */
  totalPayable: number
}

const daysPerWeek = 7

// Dates are handled as ISO strings stepped through in UTC. Going via a local Date would
// shift the day for anyone east or west of UTC, which used to move travel onto the wrong
// date entirely.
function toUtcDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00Z`)
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

/** Every date in the period, inclusive of both ends. */
function eachDate(periodStart: string, periodEnd: string) {
  const dates: string[] = []
  const cursor = toUtcDate(periodStart)
  const last = toUtcDate(periodEnd)

  while (cursor <= last) {
    dates.push(toIsoDate(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

/** Weekday counted from Monday, which is how the printed grid reads. */
function leadingBlankCount(isoDate: string) {
  return (toUtcDate(isoDate).getUTCDay() + 6) % daysPerWeek
}

function emptyDay(date: string): ReportDay {
  return {
    date,
    dayOfMonth: Number(date.slice(8, 10)),
    drivenLegCount: 0,
    drivenKm: 0,
    extraBusinessKm: 0,
    taxiAmount: 0,
  }
}

function toWeeks(
  periodStart: string,
  periodEnd: string,
  days: Map<string, ReportDay>,
) {
  const cells: ReportWeek = [
    ...Array<null>(leadingBlankCount(periodStart)).fill(null),
    ...eachDate(periodStart, periodEnd).map(
      (date) => days.get(date) ?? emptyDay(date),
    ),
  ]

  while (cells.length % daysPerWeek !== 0) {
    cells.push(null)
  }

  return Array.from({ length: cells.length / daysPerWeek }, (_, week) =>
    cells.slice(week * daysPerWeek, (week + 1) * daysPerWeek),
  )
}

export function buildMonthlyReport(
  sheet: MonthlySheet,
  crewName: string,
): MonthlyReport {
  const days = new Map<string, ReportDay>(
    sheet.days.map((day: MonthlySheetDay) => [
      day.date,
      {
        date: day.date,
        dayOfMonth: Number(day.date.slice(8, 10)),
        drivenLegCount: day.drivenLegCount,
        drivenKm: day.drivenKm,
        extraBusinessKm: day.extraBusinessKm,
        taxiAmount: day.taxiAmount,
      },
    ]),
  )

  return {
    crewName,
    recipientFullname: sheet.recipientFullname,
    year: sheet.year,
    month: sheet.month,
    periodStart: sheet.periodStart,
    periodEnd: sheet.periodEnd,
    isConfirmed: sheet.isConfirmed,
    isPaid: sheet.isPaid,
    weeks: toWeeks(sheet.periodStart, sheet.periodEnd, days),
    travelledDayCount: days.size,
    totalDrivenKm: sheet.totalDrivenKm,
    totalExtraBusinessKm: sheet.totalExtraBusinessKm,
    totalTaxiAmount: sheet.totalTaxiAmount,
    kmRate: sheet.kmRate,
    totalPricedKm: sheet.totalPricedKm,
    totalKmAmount: sheet.totalKmAmount,
    isPricedByTariff: sheet.isPricedByTariff,
    tariffPerLeg: sheet.tariffPerLeg,
    totalDrivenLegs: sheet.totalDrivenLegs,
    totalTariffAmount: sheet.totalTariffAmount,
    totalDrivingAmount: sheet.totalDrivingAmount,
    amortizationAmount: sheet.amortizationAmount,
    totalPayable: sheet.totalPayable,
  }
}

/** A day the crew neither drove nor paid for prints as a plain, unmarked cell. */
export function hasTravel(day: ReportDay) {
  return (
    day.drivenLegCount > 0 ||
    day.drivenKm > 0 ||
    day.extraBusinessKm > 0 ||
    day.taxiAmount > 0
  )
}

/**
 * Whether this cell opens a new month. A period can run from late August into September,
 * and the day number alone would then repeat without saying which month it belongs to.
 */
export function startsNewMonth(day: ReportDay) {
  return day.dayOfMonth === 1
}
