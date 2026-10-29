import { Landmark } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

import type { Period } from '@/components/month-picker'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { usePermissions } from '@/features/auth/use-permissions'
import {
  useAccountantBalance,
  useSetAccountantBalance,
} from '@/features/monthly-sheets/accountant-balance'
import { getErrorMessage } from '@/lib/api-error'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

function amountAsText(amount: number | null | undefined) {
  return amount === null || amount === undefined ? '' : String(amount)
}

/** A blank box or anything below zero is not an amount the backend would take. */
function amountAsNumber(text: string) {
  if (text.trim() === '') return null

  const parsed = Number(text)

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

interface FigureProps {
  label: string
  value: string
  tone?: 'default' | 'negative'
}

function Figure({ label, value, tone = 'default' }: FigureProps) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-lg font-semibold break-words',
          tone === 'negative' ? 'text-destructive' : 'text-foreground',
        )}
      >
        {value}
      </p>
    </div>
  )
}

/**
 * The money the accountant received for the month, and what is left of it once every
 * crew's payout — the advances handed out at the start of the month included — is taken
 * off. Mount it with a key per period so the box starts from that month's saved amount.
 */
export function AccountantBalanceCard({ period }: { period: Period }) {
  const { can } = usePermissions()
  const { data: balance, isLoading } = useAccountantBalance(period)
  const setBalanceMutation = useSetAccountantBalance()

  // `null` while the box still shows the saved amount; text once the accountant types.
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState('')

  const amountText = draft ?? amountAsText(balance?.amount)
  const amount = amountAsNumber(amountText)
  const canEdit = can('setAccountantBalance')
  const isUnchanged = amount === (balance?.amount ?? null)
  const remaining = balance?.remainingAmount ?? null

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (amount === null) return

    setError('')

    try {
      await setBalanceMutation.mutateAsync({ ...period, amount })
      setDraft(null)
    } catch (saveError) {
      setError(
        getErrorMessage(saveError, 'Could not save the accountant balance.'),
      )
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Landmark className="size-5" />
        </span>
        <CardTitle className="text-xl">Accountant balance</CardTitle>
      </CardHeader>

      <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        {canEdit && (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={handleSave}
          >
            <div className="w-full sm:w-52">
              <label
                className="text-sm font-medium text-soft-foreground"
                htmlFor="accountant-balance"
              >
                Received this month (TJS)
              </label>
              <Input
                id="accountant-balance"
                className="mt-1.5"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="Not entered"
                value={amountText}
                disabled={isLoading}
                onChange={(event) => setDraft(event.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={
                amount === null || isUnchanged || setBalanceMutation.isPending
              }
            >
              Save
            </Button>
          </form>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:min-w-[520px]">
          <Figure
            label="Received"
            value={
              balance?.amount === null || balance?.amount === undefined
                ? '—'
                : formatCurrency(balance.amount)
            }
          />
          <Figure
            label="Spent by crews"
            value={formatCurrency(balance?.spentAmount ?? 0)}
          />
          <Figure
            label="Remaining"
            value={remaining === null ? '—' : formatCurrency(remaining)}
            tone={remaining !== null && remaining < 0 ? 'negative' : 'default'}
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm font-medium text-destructive">{error}</p>
      )}
    </Card>
  )
}
