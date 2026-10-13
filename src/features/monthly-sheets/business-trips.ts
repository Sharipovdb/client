import type { MonthlySheetDay } from '@/lib/domain-types'

export interface BusinessTrip {
  date: string
  km: number
  notes: string
}

// Business kilometres are paid by the index, so the accountant needs to see where each
// one was driven. A day's notes only describe a trip when the day had one.
export function businessTripsOf(days: MonthlySheetDay[]): BusinessTrip[] {
  return days
    .filter((day) => day.extraBusinessKm > 0)
    .map((day) => ({
      date: day.date,
      km: day.extraBusinessKm,
      notes: day.notes.trim(),
    }))
}
