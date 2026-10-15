import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { PencilLine, Plus, Route as RouteIcon, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import type { Period } from '@/components/month-picker'
import { MonthPicker } from '@/components/month-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/features/auth/auth-context'
import { useCrewMemberships } from '@/features/crews/crew-memberships-context'
import { useCrews } from '@/features/crews/crews-context'
import { useEmployees } from '@/features/employees/employees-context'
import type { TransportDayChanges } from '@/features/transport-days/transport-days-context'
import { useTransportDays } from '@/features/transport-days/transport-days-context'
import { getErrorMessage } from '@/lib/api-error'
import {
  isCrewLedBy,
  isDayOpen,
  isSameId,
  legLabels,
  transportModeLabels,
  transportModes,
} from '@/lib/domain-types'
import type { Leg, TaxiFareDraft, TransportMode } from '@/lib/domain-types'
import {
  formatCurrency,
  formatDayLabel,
  formatKm,
  formatMonthLabel,
  getMonthYear,
} from '@/lib/format'
import { useCapability } from '@/lib/use-capability'

export const Route = createFileRoute('/transport-days')({
  component: TransportDaysPage,
})

// A leg travelled by taxi has to say what it cost and who paid, otherwise the ride can
// never be reimbursed — the backend rejects a taxi leg without its fare, so the form
// asks for it here rather than sending the user to a second screen afterwards.
const taxiFareSchema = z.object({
  amount: z.coerce.number(),
  paidById: z.string(),
})

const legFields = [
  {
    leg: 'Morning' as Leg,
    mode: 'morningMode' as const,
    fare: 'morningTaxi' as const,
  },
  {
    leg: 'Afternoon' as Leg,
    mode: 'afternoonMode' as const,
    fare: 'afternoonTaxi' as const,
  },
]

const dayFormSchema = z
  .object({
    crewId: z.string().min(1, 'Select a crew.'),
    date: z.string().min(1, 'Select a date.'),
    dateTo: z.string(),
    skipWeekends: z.boolean(),
    morningMode: z.enum(transportModes),
    afternoonMode: z.enum(transportModes),
    extraBusinessKm: z.coerce
      .number()
      .nonnegative('Extra km cannot be negative.'),
    notes: z.string(),
    morningTaxi: taxiFareSchema,
    afternoonTaxi: taxiFareSchema,
  })
  .superRefine((values, context) => {
    if (values.dateTo && values.dateTo < values.date) {
      context.addIssue({
        code: 'custom',
        path: ['dateTo'],
        message: 'The end date must not be before the start date.',
      })
    }

    if (values.extraBusinessKm > 0 && !values.notes.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['notes'],
        message: 'Say where the extra business km were driven.',
      })
    }

    for (const leg of legFields) {
      if (values[leg.mode] !== 'Taxi') {
        continue
      }

      if (!(values[leg.fare].amount > 0)) {
        context.addIssue({
          code: 'custom',
          path: [leg.fare, 'amount'],
          message: 'Enter the fare for this taxi ride.',
        })
      }

      if (!values[leg.fare].paidById) {
        context.addIssue({
          code: 'custom',
          path: [leg.fare, 'paidById'],
          message: 'Select who paid for it.',
        })
      }
    }
  })

type DayFormInput = z.input<typeof dayFormSchema>
type DayFormValues = z.output<typeof dayFormSchema>

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function defaultValues(crewId = ''): DayFormInput {
  return {
    crewId,
    date: todayIsoDate(),
    dateTo: '',
    skipWeekends: true,
    morningMode: 'Driven',
    afternoonMode: 'Driven',
    extraBusinessKm: 0,
    notes: '',
    morningTaxi: { amount: 0, paidById: '' },
    afternoonTaxi: { amount: 0, paidById: '' },
  }
}

function isRange(date: string, dateTo: string) {
  return dateTo !== '' && dateTo !== date
}

function toChanges(values: DayFormValues): TransportDayChanges {
  const taxiFares: TaxiFareDraft[] = legFields
    .filter((leg) => values[leg.mode] === 'Taxi')
    .map((leg) => ({
      leg: leg.leg,
      amount: values[leg.fare].amount,
      paidById: Number(values[leg.fare].paidById),
    }))

  return {
    morningMode: values.morningMode,
    afternoonMode: values.afternoonMode,
    extraBusinessKm: values.extraBusinessKm,
    notes: values.notes,
    taxiFares,
  }
}

const modeBadgeVariant: Record<
  TransportMode,
  'success' | 'warning' | 'secondary'
> = {
  Driven: 'success',
  Taxi: 'warning',
  None: 'secondary',
}

function TransportDaysPage() {
  const { session } = useAuth()
  const { crews, getCrewName } = useCrews()
  const { getActiveMembersForCrew } = useCrewMemberships()
  const { getEmployeeDisplayName } = useEmployees()
  const {
    transportDays,
    isLoading,
    addTransportDay,
    addTransportDayRange,
    updateTransportDay,
    deleteTransportDay,
  } = useTransportDays()

  const [period, setPeriod] = useState<Period>(() =>
    getMonthYear(todayIsoDate()),
  )
  const [crewFilter, setCrewFilter] = useState('')
  const [editingDayId, setEditingDayId] = useState<number | null>(null)
  const [formError, setFormError] = useState('')
  const [deletingDayId, setDeletingDayId] = useState<number | null>(null)

  const canCreateTransportDay = useCapability('createTransportDay')
  const canUpdateTransportDay = useCapability('updateTransportDay')
  const canDeleteTransportDay = useCapability('deleteTransportDay')

  // The Actions column exists only for a role that has an action in it. Creating is done
  // in the form beside the table, not in a row, so it does not earn the column — and the
  // header, the row cell and the empty-state colSpan all read this one answer, or the
  // table ends up one cell wider than its own header.
  const showRowActions = canUpdateTransportDay || canDeleteTransportDay

  const ledCrewId = useMemo(() => {
    const ledCrew = crews.find((crew) => isCrewLedBy(crew, session?.id))

    return ledCrew ? String(ledCrew.id) : ''
  }, [crews, session?.id])

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DayFormInput, any, DayFormValues>({
    resolver: zodResolver(dayFormSchema),
    defaultValues: defaultValues(ledCrewId),
  })

  useEffect(() => {
    if (ledCrewId && !getValues('crewId')) {
      setValue('crewId', ledCrewId)
    }
  }, [ledCrewId])

  const editingDay = editingDayId
    ? (transportDays.find((day) => day.id === editingDayId) ?? null)
    : null

  const formCrewId = watch('crewId')
  const formDate = watch('date')
  const formDateTo = watch('dateTo')
  const morningMode = watch('morningMode')
  const afternoonMode = watch('afternoonMode')
  const isRangeSelected = !editingDay && isRange(formDate, formDateTo)

  // Only members of the selected crew can front a taxi fare — the backend enforces it,
  // so the form offers exactly that list instead of every employee in the company.
  const crewMembers = useMemo(() => {
    const crew = crews.find((candidate) => isSameId(candidate.id, formCrewId))

    if (!crew) {
      return []
    }

    return getActiveMembersForCrew(crew.id).map((membership) => ({
      id: String(membership.employeeId),
      name: getEmployeeDisplayName(membership.employeeId),
    }))
  }, [crews, formCrewId, getActiveMembersForCrew, getEmployeeDisplayName])

  const visibleDays = useMemo(() => {
    return transportDays
      .filter((day) => {
        const inPeriod =
          getMonthYear(day.date).year === period.year &&
          getMonthYear(day.date).month === period.month
        const inCrew = !crewFilter || isSameId(day.crewId, crewFilter)
        return inPeriod && inCrew
      })
      .sort((first, second) => second.date.localeCompare(first.date))
  }, [transportDays, period, crewFilter])

  // Paying a day's fare closes the day, so the backend refuses to save it. Drop out of
  // edit mode rather than leaving the form pointed at a record that can't be saved.
  const isEditingDayOpen = editingDay === null || isDayOpen(editingDay)

  useEffect(() => {
    if (!isEditingDayOpen) {
      resetForm()
    }
  }, [isEditingDayOpen])

  function resetForm() {
    setEditingDayId(null)
    setFormError('')
    reset(defaultValues(ledCrewId))
  }

  function startEdit(dayId: number) {
    const day = transportDays.find((candidate) => candidate.id === dayId)

    if (!day) {
      return
    }

    const fareFor = (leg: Leg) => {
      const fare = day.taxiFares.find((candidate) => candidate.leg === leg)

      return {
        amount: fare?.amount ?? 0,
        paidById: fare ? String(fare.paidById) : '',
      }
    }

    setEditingDayId(dayId)
    setFormError('')
    reset({
      crewId: String(day.crewId),
      date: day.date,
      dateTo: '',
      skipWeekends: true,
      morningMode: day.morningMode,
      afternoonMode: day.afternoonMode ?? 'None',
      extraBusinessKm: day.extraBusinessKm,
      notes: day.notes ?? '',
      morningTaxi: fareFor('Morning'),
      afternoonTaxi: fareFor('Afternoon'),
    })
  }

  const onSubmit = handleSubmit(async (values: DayFormValues) => {
    setFormError('')

    try {
      if (editingDayId) {
        await updateTransportDay(editingDayId, toChanges(values))
      } else if (isRange(values.date, values.dateTo)) {
        await addTransportDayRange({
          crewId: Number(values.crewId),
          dateFrom: values.date,
          dateTo: values.dateTo,
          skipWeekends: values.skipWeekends,
          ...toChanges(values),
        })
      } else {
        await addTransportDay({
          crewId: Number(values.crewId),
          date: values.date,
          ...toChanges(values),
        })
      }

      resetForm()
    } catch (error) {
      setFormError(getErrorMessage(error, 'Could not save this transport day.'))
    }
  })

  async function removeDay(dayId: number) {
    if (editingDayId === dayId) {
      resetForm()
    }

    try {
      await deleteTransportDay(dayId)
    } catch (error) {
      setFormError(getErrorMessage(error, 'Could not remove this day.'))
    }
  }

  function driverName(driverId: number | null) {
    return driverId ? getEmployeeDisplayName(driverId) : '—'
  }

  // Someone who may neither log a new day nor amend an existing one has no use for the
  // form, so the page collapses to the list rather than showing inputs that cannot save.
  const canLogDay = canCreateTransportDay || canUpdateTransportDay

  return (
    <section
      className={
        canLogDay
          ? 'grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[380px_minmax(0,1fr)]'
          : 'grid gap-6'
      }
    >
      {canLogDay && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>
                {editingDay ? 'Edit Transport Day' : 'Log Transport Day'}
              </CardTitle>
            </div>

            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <RouteIcon className="size-5" />
            </div>
          </CardHeader>

          <form className="mt-2 space-y-5" onSubmit={onSubmit}>
            <Field label="Crew" htmlFor="crewId" error={errors.crewId?.message}>
              <Select
                id="crewId"
                disabled={!!editingDay}
                {...register('crewId')}
              >
                <option value="">Select crew…</option>
                {crews.map((crew) => (
                  <option key={crew.id} value={crew.id}>
                    {crew.name}
                  </option>
                ))}
              </Select>
            </Field>

            {editingDay ? (
              <Field label="Date" htmlFor="date" error={errors.date?.message}>
                <Input id="date" type="date" disabled {...register('date')} />
              </Field>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Field label="From" htmlFor="date" error={errors.date?.message}>
                  <Input id="date" type="date" {...register('date')} />
                </Field>

                <Field
                  label="To"
                  htmlFor="dateTo"
                  error={errors.dateTo?.message}
                >
                  <Input
                    id="dateTo"
                    type="date"
                    min={formDate}
                    {...register('dateTo')}
                  />
                </Field>
              </div>
            )}

            {isRangeSelected && (
              <label
                className="flex items-center gap-3 text-sm font-medium text-soft-foreground"
                htmlFor="skipWeekends"
              >
                <Controller
                  name="skipWeekends"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="skipWeekends"
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
                    />
                  )}
                />
                Skip weekends
              </label>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Morning"
                htmlFor="morningMode"
                error={errors.morningMode?.message}
              >
                <Select id="morningMode" {...register('morningMode')}>
                  {transportModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {transportModeLabels[mode]}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Afternoon"
                htmlFor="afternoonMode"
                error={errors.afternoonMode?.message}
              >
                <Select id="afternoonMode" {...register('afternoonMode')}>
                  {transportModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {transportModeLabels[mode]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {morningMode === 'Taxi' && (
              <TaxiFareFields
                leg="Morning"
                members={crewMembers}
                amountField={register('morningTaxi.amount')}
                payerField={register('morningTaxi.paidById')}
                amountError={errors.morningTaxi?.amount?.message}
                payerError={errors.morningTaxi?.paidById?.message}
              />
            )}

            {afternoonMode === 'Taxi' && (
              <TaxiFareFields
                leg="Afternoon"
                members={crewMembers}
                amountField={register('afternoonTaxi.amount')}
                payerField={register('afternoonTaxi.paidById')}
                amountError={errors.afternoonTaxi?.amount?.message}
                payerError={errors.afternoonTaxi?.paidById?.message}
              />
            )}

            <Field
              label="Extra Business Km"
              htmlFor="extraBusinessKm"
              error={errors.extraBusinessKm?.message}
            >
              <Input
                id="extraBusinessKm"
                type="number"
                min="0"
                step="0.1"
                {...register('extraBusinessKm')}
              />
            </Field>

            <Field
              label="Business trip notes"
              htmlFor="notes"
              error={errors.notes?.message}
            >
              <Textarea
                id="notes"
                rows={3}
                placeholder="Where the extra business km were driven — required when there are any"
                {...register('notes')}
              />
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
                {editingDay ? (
                  <PencilLine className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                {editingDay
                  ? 'Save Changes'
                  : isRangeSelected
                    ? 'Log Days'
                    : 'Log Day'}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-2xl border-border px-5 text-soft-foreground"
                onClick={resetForm}
              >
                Clear Form
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>
              {formatMonthLabel(period.year, period.month)}
            </CardTitle>
            <CardDescription className="mt-2">
              {isLoading ? 'Loading…' : `${visibleDays.length} day(s) shown.`}
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
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Crew</TableHead>
                <TableHead>Travel</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead className="text-right">Driven km</TableHead>
                <TableHead className="text-right">Extra km</TableHead>
                <TableHead>Taxi fare</TableHead>
                {showRowActions && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleDays.map((day) => {
                const isOpen = isDayOpen(day)
                const closedReason = 'Its taxi fare has already been paid'

                return (
                  <TableRow key={day.id}>
                    <TableCell className="font-medium text-foreground">
                      {formatDayLabel(day.date)}
                    </TableCell>
                    <TableCell>{getCrewName(day.crewId)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={modeBadgeVariant[day.morningMode]}>
                          {transportModeLabels[day.morningMode]}
                        </Badge>
                        {day.afternoonMode && (
                          <Badge variant={modeBadgeVariant[day.afternoonMode]}>
                            {transportModeLabels[day.afternoonMode]}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{driverName(day.driverId)}</TableCell>
                    <TableCell className="text-right">
                      {day.drivenKm > 0 ? (
                        formatKm(day.drivenKm)
                      ) : (
                        <span className="text-faint-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {day.extraBusinessKm > 0 ? (
                        formatKm(day.extraBusinessKm)
                      ) : (
                        <span className="text-faint-foreground">—</span>
                      )}
                      {day.notes && (
                        <p
                          className="ml-auto mt-0.5 max-w-48 truncate text-xs text-muted-foreground"
                          title={day.notes}
                        >
                          {day.notes}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {day.taxiFares.length === 0 ? (
                        <span className="text-faint-foreground">—</span>
                      ) : (
                        <div className="space-y-1">
                          {day.taxiFares.map((fare) => (
                            <div
                              key={fare.id}
                              className="flex items-center gap-2 whitespace-nowrap"
                            >
                              <span className="text-muted-foreground">
                                {legLabels[fare.leg]}
                              </span>
                              <span className="font-medium text-soft-foreground">
                                {formatCurrency(fare.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    {showRowActions && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canUpdateTransportDay && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              className="rounded-full border-border text-accent-foreground"
                              disabled={!isOpen}
                              title={isOpen ? 'Edit' : closedReason}
                              onClick={() => startEdit(day.id)}
                            >
                              <PencilLine className="size-3.5" />
                            </Button>
                          )}
                          {canDeleteTransportDay && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon-sm"
                              className="rounded-full"
                              disabled={!isOpen}
                              title={isOpen ? 'Delete' : closedReason}
                              onClick={() => setDeletingDayId(day.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}

              {!isLoading && visibleDays.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={showRowActions ? 8 : 7}
                    className="py-10 text-center text-faint-foreground"
                  >
                    No transport days logged for this period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <ConfirmDialog
        open={deletingDayId !== null}
        onOpenChange={(open) => !open && setDeletingDayId(null)}
        title="Delete this transport day?"
        description="Its taxi expenses go with it. This action cannot be undone."
        onConfirm={() => {
          if (deletingDayId !== null) {
            removeDay(deletingDayId)
          }
        }}
      />
    </section>
  )
}

interface TaxiFareFieldsProps {
  leg: Leg
  members: { id: string; name: string }[]
  amountField: UseFormRegisterReturn
  payerField: UseFormRegisterReturn
  amountError?: string
  payerError?: string
}

function TaxiFareFields({
  leg,
  members,
  amountField,
  payerField,
  amountError,
  payerError,
}: TaxiFareFieldsProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-warning/30 bg-warning/10 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-warning">
        {legLabels[leg]} taxi fare
      </p>

      <Field
        label="Fare (TJS)"
        htmlFor={`${leg}-taxi-amount`}
        error={amountError}
      >
        <Input
          id={`${leg}-taxi-amount`}
          type="number"
          min="0"
          step="1"
          {...amountField}
        />
      </Field>

      <Field label="Paid by" htmlFor={`${leg}-taxi-payer`} error={payerError}>
        <Select id={`${leg}-taxi-payer`} {...payerField}>
          <option value="">Select crew member…</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </Select>
        {members.length === 0 && (
          <p className="text-xs text-warning">
            This crew has no active members to charge the fare to.
          </p>
        )}
      </Field>
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
