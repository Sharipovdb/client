import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({
  className,
  type = 'text',
  ...props
}: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-2xl border border-border bg-muted/70 px-4 py-3 text-sm text-soft-foreground outline-none transition focus:border-ring focus:bg-card',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
