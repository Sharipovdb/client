import * as React from 'react'
import { cva  } from 'class-variance-authority'
import type {VariantProps} from 'class-variance-authority';

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-sky-100 text-sky-700',
        secondary: 'border-transparent bg-slate-100 text-slate-600',
        success: 'border-transparent bg-emerald-100 text-emerald-700',
        warning: 'border-transparent bg-amber-100 text-amber-700',
        destructive: 'border-transparent bg-red-100 text-red-700',
        outline: 'border-sky-200 bg-white text-slate-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props} />
  )
}

export { Badge, badgeVariants }
