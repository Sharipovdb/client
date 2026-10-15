import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex min-h-24 w-full rounded-2xl border border-border bg-muted/70 px-4 py-3 text-sm text-soft-foreground outline-none transition focus:border-ring focus:bg-card',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
