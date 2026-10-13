import type { BusinessTrip } from './business-trips'
import { formatDayLabel, formatKm } from '@/lib/format'

export function BusinessTripList({ trips }: { trips: BusinessTrip[] }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-slate-900">Business trips</h3>
      <ul className="mt-2 divide-y divide-sky-100 rounded-xl border border-sky-100">
        {trips.map((trip) => (
          <li
            key={trip.date}
            className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-baseline sm:gap-4"
          >
            <span className="w-28 shrink-0 font-medium text-slate-900">
              {formatDayLabel(trip.date)}
            </span>
            <span className="w-20 shrink-0 text-slate-500 sm:text-right">
              {formatKm(trip.km)}
            </span>
            {trip.notes ? (
              <span className="break-words text-slate-700">{trip.notes}</span>
            ) : (
              <span className="text-slate-400">No description</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
