import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * `min-w` is what makes the wrapper scroll instead of the table collapsing. Without a
 * floor, `w-full` lets a narrow screen crush every column into a couple of characters —
 * the table looked cut off rather than scrollable. Pages with many columns raise the
 * floor by passing their own `min-w-*`.
 */
function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="-mx-1 w-full overflow-x-auto px-1">
      <table
        className={cn('w-full min-w-[640px] caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={cn('border-b border-border', className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      className={cn('border-t border-border bg-muted/50 font-medium', className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn('transition-colors hover:bg-muted/60', className)}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'h-11 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground first:pl-1 last:pr-1',
        className,
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      className={cn('px-3 py-3 align-middle text-soft-foreground first:pl-1 last:pr-1', className)}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return <caption className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
}

export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption }
