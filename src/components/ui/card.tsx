import * as React from 'react'

import { cn } from '@/lib/utils'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'rounded-3xl border border-sky-100 bg-white p-4 shadow-[0_20px_60px_-45px_rgba(14,116,144,0.45)] sm:rounded-[28px] sm:p-6',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-col gap-1.5', className)}
      {...props}
    />
  )
}

function CardEyebrow({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-eyebrow"
      className={cn('text-sm font-semibold uppercase tracking-[0.28em] text-sky-500', className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2
      data-slot="card-title"
      className={cn('text-2xl font-semibold text-slate-950', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-sm leading-6 text-slate-500', className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('mt-6', className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('mt-6 flex flex-wrap items-center gap-3', className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardEyebrow, CardTitle, CardDescription, CardContent, CardFooter }
