import type { LucideIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  hint?: string
}

export function StatCard({ label, value, icon: Icon, hint }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          {/* Money and distances are the point of these cards, so they wrap rather
              than truncate — "653 T…" is worse than a second line. */}
          <p className="mt-2 text-xl font-semibold break-words text-foreground sm:text-2xl">
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-faint-foreground">{hint}</p>}
        </div>

        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
      </div>
    </Card>
  )
}
