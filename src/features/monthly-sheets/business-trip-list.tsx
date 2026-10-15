import type { BusinessTrip } from './business-trips'
import { formatDayLabel, formatKm } from '@/lib/format'

export function BusinessTripList({ trips }: { trips: BusinessTrip[] }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-foreground">Business trips</h3>
      <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
        {trips.map((trip) => (
          <li
            key={trip.date}
            className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-baseline sm:gap-4"
          >
            <span className="w-28 shrink-0 font-medium text-foreground">
              {formatDayLabel(trip.date)}
            </span>
            <span className="w-20 shrink-0 text-muted-foreground sm:text-right">
              {formatKm(trip.km)}
            </span>
            {trip.notes ? (
              <span className="break-words text-soft-foreground">{trip.notes}</span>
            ) : (
              <span className="text-faint-foreground">No description</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
