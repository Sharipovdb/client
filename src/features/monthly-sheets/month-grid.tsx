import { hasTravel, startsNewMonth } from './monthly-report'
import type { MonthlyReport, ReportDay } from './monthly-report'
import { formatCurrency, formatKm, monthName } from '@/lib/format'

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * The month exactly as the printed report shows it: one cell is one day, marked with
 * what the crew's own driving was worth that day and the taxi fare it cost. Both read
 * the same `MonthlyReport`, so the screen can never disagree with the PDF.
 *
 * A crew on a tariff earns by the leg, so its cells count legs; every other crew is
 * priced by distance and shows kilometres.
 *
 * A lead paid in advance also sees, under each travelled day, what is left of the
 * opening balance once that day is taken off it.
 *
 * The grid spans the period actually settled, which can run from one month into the next,
 * so the 1st of a month is labelled with its name to keep the day numbers unambiguous.
 */
function cellLabel(day: ReportDay) {
  return startsNewMonth(day)
    ? `1 ${monthName(Number(day.date.slice(5, 7))).slice(0, 3)}`
    : String(day.dayOfMonth)
}
export function MonthGrid({ report }: { report: MonthlyReport }) {
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-7 gap-1">
        {weekdays.map((weekday) => (
          <div
            key={weekday}
            className="px-2 py-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            {weekday}
          </div>
        ))}

        {report.weeks.flat().map((day, index) =>
          day === null ? (
            <div key={`blank-${index}`} />
          ) : (
            <div
              key={day.date}
              className={
                hasTravel(day)
                  ? 'min-h-16 rounded-xl border border-sky-200 bg-sky-50 px-2 py-1.5'
                  : 'min-h-16 rounded-xl border border-slate-100 px-2 py-1.5'
              }
            >
              <span
                className={
                  hasTravel(day)
                    ? 'text-xs font-semibold text-slate-900'
                    : 'text-xs text-slate-300'
                }
              >
                {cellLabel(day)}
              </span>

              {report.isPricedByTariff ? (
                day.drivenLegCount > 0 && (
                  <>
                    <p className="mt-0.5 text-xs font-medium text-slate-700">
                      {day.drivenLegCount === 2 ? '2 legs' : '1 leg'}
                    </p>
                    <p className="text-xs text-sky-700">
                      {formatCurrency(day.drivenLegCount * report.tariffPerLeg)}
                    </p>
                  </>
                )
              ) : (
                <>
                  {day.drivenKm > 0 && (
                    <p className="mt-0.5 text-xs font-medium text-slate-700">
                      {formatKm(day.drivenKm)}
                    </p>
                  )}
                  {day.extraBusinessKm > 0 && (
                    <p className="text-xs text-slate-500">
                      +{formatKm(day.extraBusinessKm)}
                    </p>
                  )}
                </>
              )}
              {day.taxiAmount > 0 && (
                <p className="mt-0.5 text-xs font-medium text-amber-700">
                  {formatCurrency(day.taxiAmount)}
                </p>
              )}
              {day.balance !== null && (
                <p
                  className={
                    day.balance < 0
                      ? 'mt-0.5 text-xs font-semibold text-red-600'
                      : 'mt-0.5 text-xs font-semibold text-emerald-700'
                  }
                >
                  {formatCurrency(day.balance)}
                </p>
              )}
            </div>
          ),
        )}
      </div>
    </div>
  )
}
