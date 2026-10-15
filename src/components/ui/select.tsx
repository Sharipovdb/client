import * as React from 'react'

import { cn } from '@/lib/utils'

function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'flex h-11 w-full rounded-2xl border border-border bg-muted/70 px-4 py-3 text-sm text-soft-foreground outline-none transition focus:border-ring focus:bg-card',
        className,
      )}
      {...props}
    />
  )
}

export { Select }
