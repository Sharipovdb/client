import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { PencilLine, Receipt } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import type { Period } from '@/components/month-picker'
import { MonthPicker } from '@/components/month-picker'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePermissions } from '@/features/auth/use-permissions'
import { useCrewMemberships } from '@/features/crews/crew-memberships-context'
import { useCrews } from '@/features/crews/crews-context'
import { useEmployees } from '@/features/employees/employees-context'
import { useTaxiExpenses } from '@/features/taxi-expenses/taxi-expenses-context'
import { useTransportDays } from '@/features/transport-days/transport-days-context'
import { getErrorMessage } from '@/lib/api-error'
import { isSameId, legLabels } from '@/lib/domain-types'
import {
  formatCurrency,
  formatDayLabel,
  formatMonthLabel,
  getMonthYear,
} from '@/lib/format'

export const Route = createFileRoute('/taxi-expenses')({
  component: TaxiExpensesPage,
})

// Expenses are created with the transport day that produced them, so this screen only
// amends what a ride cost and who paid — the ride itself is not re-entered here.
const expenseFormSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0.'),
  paidById: z.string().min(1, 'Select who paid.'),
})

type ExpenseFormInput = z.input<typeof expenseFormSchema>
type ExpenseFormValues = z.output<typeof expenseFormSchema>

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function TaxiExpensesPage() {
  const { can } = usePermissions()
  const { crews, getCrewName } = useCrews()
  const { getActiveMembersForCrew } = useCrewMemberships()
  const { getEmployeeDisplayName } = useEmployees()
  const { getDayById } = useTransportDays()
  const { taxiExpenses, isLoading, updateTaxiExpense } = useTaxiExpenses()

  const canUpdateExpense = can('updateTaxiExpense')

  const [period, setPeriod] = useState<Period>(() =>
    getMonthYear(todayIsoDate()),
  )
  const [crewFilter, setCrewFilter] = useState('')
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null)
  const [formError, setFormError] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormInput, any, ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: { amount: 0, paidById: '' },
  })

  const editingExpense = editingExpenseId
    ? (taxiExpenses.find((candidate) => candidate.id === editingExpenseId) ??
      null)
    : null
  const editingDay = editingExpense
    ? getDayById(editingExpense.transportDayId)
    : undefined

  // Only members of the crew that took the ride can be charged for it — the backend
  // enforces the same rule when the change is saved.
  const editingCrewMembers = useMemo(() => {
    const crew = crews.find((candidate) =>
      isSameId(candidate.id, editingDay?.crewId),
    )

    if (!crew) {
      return []
    }

    return getActiveMembersForCrew(crew.id).map((membership) => ({
      id: String(membership.employeeId),
      name: getEmployeeDisplayName(membership.employeeId),
    }))
  }, [
    crews,
    editingDay?.crewId,
    getActiveMembersForCrew,
    getEmployeeDisplayName,
  ])

  const visibleExpenses = useMemo(() => {
    return taxiExpenses
      .filter((expense) => {
        const day = getDayById(expense.transportDayId)

        if (!day) {
          return false
        }

        const inPeriod =
          getMonthYear(day.date).year === period.year &&
          getMonthYear(day.date).month === period.month
        const inCrew = !crewFilter || isSameId(day.crewId, crewFilter)

        return inPeriod && inCrew
      })
      .sort((first, second) =>
        (getDayById(second.transportDayId)?.date ?? '').localeCompare(
          getDayById(first.transportDayId)?.date ?? '',
        ),
      )
  }, [taxiExpenses, period, crewFilter, getDayById])

  function resetForm() {
    setEditingExpenseId(null)
    setFormError('')
    reset({ amount: 0, paidById: '' })
  }

  function startEdit(expenseId: number) {
    const expense = taxiExpenses.find((candidate) => candidate.id === expenseId)

    if (!expense) {
      return
    }

    setEditingExpenseId(expenseId)
    setFormError('')
    reset({ amount: expense.amount, paidById: String(expense.paidById) })
  }

  const onSubmit = handleSubmit(async (values: ExpenseFormValues) => {
    if (!editingExpense) {
      return
    }

    setFormError('')

    try {
      await updateTaxiExpense(editingExpense.id, {
        amount: values.amount,
        paidById: values.paidById,
      })

      resetForm()
    } catch (error) {
      setFormError(getErrorMessage(error, 'Could not save this taxi expense.'))
    }
  })

  return (
    <section
      className={
        canUpdateExpense
          ? 'grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[380px_minmax(0,1fr)]'
          : 'grid gap-6'
      }
    >
      {canUpdateExpense && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Amend Taxi Expense</CardTitle>
            </div>

            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Receipt className="size-5" />
            </div>
          </CardHeader>

          {!editingExpense ? (
            <p className="mt-6 rounded-2xl bg-muted/60 px-4 py-8 text-center text-sm text-muted-foreground">
              No expense selected.
            </p>
          ) : (
            <form className="mt-2 space-y-5" onSubmit={onSubmit}>
              <dl className="space-y-2 rounded-2xl bg-muted/60 p-4 text-sm">
                <Summary
                  label="Day"
                  value={editingDay ? formatDayLabel(editingDay.date) : '—'}
                />
                <Summary
                  label="Crew"
                  value={editingDay ? getCrewName(editingDay.crewId) : '—'}
                />
                <Summary label="Leg" value={legLabels[editingExpense.leg]} />
              </dl>

              <Field
                label="Amount (TJS)"
                htmlFor="amount"
                error={errors.amount?.message}
              >
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="1"
                  {...register('amount')}
                />
              </Field>

              <Field
                label="Paid By"
                htmlFor="paidById"
                error={errors.paidById?.message}
              >
                <Select id="paidById" {...register('paidById')}>
                  <option value="">Select crew member…</option>
                  {editingCrewMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </Select>
              </Field>

              {formError && (
                <p className="text-xs font-medium text-destructive">{formError}</p>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  type="submit"
                  className="h-11 rounded-2xl px-5"
                  disabled={isSubmitting}
                >
                  <PencilLine className="size-4" />
                  Save Changes
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-2xl border-border px-5 text-soft-foreground"
                  onClick={resetForm}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      <Card>
        <CardHeader className="flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>
              {formatMonthLabel(period.year, period.month)}
            </CardTitle>
            <CardDescription className="mt-2">
              {isLoading
                ? 'Loading…'
                : `${visibleExpenses.length} expense(s) shown.`}
            </CardDescription>
          </div>

          <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
            <Select
              value={crewFilter}
              onChange={(event) => setCrewFilter(event.target.value)}
              className="w-full sm:w-48"
            >
              <option value="">All crews</option>
              {crews.map((crew) => (
                <option key={crew.id} value={crew.id}>
                  {crew.name}
                </option>
              ))}
            </Select>
            <MonthPicker value={period} onChange={setPeriod} />
          </div>
        </CardHeader>

        <div className="mt-4">
          <Table className="min-w-[780px]">
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Crew</TableHead>
                <TableHead>Leg</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Paid By</TableHead>
                {canUpdateExpense && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleExpenses.map((expense) => {
                const day = getDayById(expense.transportDayId)
                const isPaid = expense.taxiExpenseStatus === 'Paid'

                return (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium text-foreground">
                      {day ? formatDayLabel(day.date) : '—'}
                    </TableCell>
                    <TableCell>{day ? getCrewName(day.crewId) : '—'}</TableCell>
                    <TableCell>{legLabels[expense.leg]}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell>
                      {getEmployeeDisplayName(expense.paidById)}
                    </TableCell>
                    {canUpdateExpense && (
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="rounded-full border-border text-accent-foreground"
                          disabled={isPaid}
                          onClick={() => startEdit(expense.id)}
                          title={isPaid ? 'Already paid' : 'Amend'}
                        >
                          <PencilLine className="size-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}

              {!isLoading && visibleExpenses.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={canUpdateExpense ? 6 : 5}
                    className="py-10 text-center text-faint-foreground"
                  >
                    No taxi expenses recorded for this period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </section>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-soft-foreground">{value}</dd>
    </div>
  )
}

interface FieldProps {
  label: string
  htmlFor: string
  error?: string
  children: React.ReactNode
}

function Field({ label, htmlFor, error, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-soft-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  )
}
