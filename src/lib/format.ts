// Shared formatters so every screen renders money, dates, and month labels the same way.
// Single currency (TJS) per the spec's non-goal on multi-currency.

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function formatCurrency(amount: number) {
  return `${amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} TJS`
}

/** The kilometre index, e.g. "1.5 TJS/km". Kept finer than money — it is a rate. */
export function formatKmRate(rate: number) {
  return `${rate.toLocaleString('en-US', { maximumFractionDigits: 4 })} TJS/km`
}

export function formatKm(km: number) {
  return `${km.toLocaleString('en-US', { maximumFractionDigits: 1 })} km`
}

/**
 * The stretch a sheet settles, e.g. "28 Jul – 27 Aug 2026". Spelled out rather than shown
 * as a month name, because a settlement closed early does not cover the month it is
 * named for and saying "August" would be wrong.
 */
export function formatPeriodRange(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00Z`)
  const end = new Date(`${endIso}T00:00:00Z`)

  const day = (date: Date) =>
    `${date.getUTCDate()} ${monthNames[date.getUTCMonth()].slice(0, 3)}`

  return `${day(start)} – ${day(end)} ${end.getUTCFullYear()}`
}

// month is 1-12.
export function formatMonthLabel(year: number, month: number) {
  return `${monthNames[month - 1]} ${year}`
}

export function monthName(month: number) {
  return monthNames[month - 1]
}

// Short, human day label from an ISO date, e.g. "Wed, 01 Jul".
export function formatDayLabel(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`)

  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

export function getMonthYear(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`)

  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}
