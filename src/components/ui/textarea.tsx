import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex min-h-24 w-full rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
