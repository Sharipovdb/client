import { useMemo } from 'react'

import { Select } from '@/components/ui/select'
import { useTransportDays } from '@/features/transport-days/transport-days-context'
import { getMonthYear, monthName } from '@/lib/format'

export interface Period {
  year: number
  month: number
}

interface MonthPickerProps {
  value: Period
  onChange: (period: Period) => void
}

const months = Array.from({ length: 12 }, (_, index) => index + 1)

export function MonthPicker({ value, onChange }: MonthPickerProps) {
  const { transportDays } = useTransportDays()

  const years = useMemo(() => {
    const uniqueYears = new Set(transportDays.map((day) => getMonthYear(day.date).year))
    uniqueYears.add(value.year)
    return [...uniqueYears].sort((first, second) => first - second)
  }, [transportDays, value.year])

  return (
    <div className="flex w-full gap-3 sm:w-auto">
      <Select
        aria-label="Month"
        className="w-full sm:w-40"
        value={value.month}
        onChange={(event) => onChange({ ...value, month: Number(event.target.value) })}
      >
        {months.map((month) => (
          <option key={month} value={month}>
            {monthName(month)}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Year"
        className="w-28 shrink-0"
        value={value.year}
        onChange={(event) => onChange({ ...value, year: Number(event.target.value) })}
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </Select>
    </div>
  )
}
