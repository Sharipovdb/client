import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { Coins, PencilLine, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCrews } from '@/features/crews/crews-context'
import { useTariffs } from '@/features/tariffs/tariffs-context'
import { getErrorMessage } from '@/lib/api-error'
import { formatCurrency } from '@/lib/format'
import { useCapability } from '@/lib/use-capability'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/tariffs')({
  component: TariffsPage,
})

const tariffFormSchema = z.object({
  name: z.string().trim().min(2, 'Name must contain at least 2 characters.'),
  // Zero is not a cheaper tariff, it is no tariff at all: a crew on it would be paid
  // nothing for driving. Leaving a crew off tariffs is how it goes back to distance.
  amountPerLeg: z.coerce
    .number()
    .positive('The amount per leg must be greater than 0.'),
})

type TariffFormInput = z.input<typeof tariffFormSchema>
type TariffFormValues = z.output<typeof tariffFormSchema>

const defaultValues: TariffFormInput = {
  name: '',
  amountPerLeg: 0,
}

function TariffsPage() {
  const { crews } = useCrews()
  const { tariffs, isLoading, addTariff, updateTariff, deleteTariff } =
    useTariffs()

  const [editingTariffId, setEditingTariffId] = useState<number | null>(null)
  const [formError, setFormError] = useState('')
  const [deletingTariffId, setDeletingTariffId] = useState<number | null>(null)

  const canCreateTariff = useCapability('createTariff')
  const canUpdateTariff = useCapability('updateTariff')
  const canDeleteTariff = useCapability('deleteTariff')

  const editingTariff =
    editingTariffId === null
      ? null
      : (tariffs.find((tariff) => tariff.id === editingTariffId) ?? null)

  // Which crews each price is currently paying. A tariff still in use cannot be
  // withdrawn, so this is the list that has to be emptied first.
  const crewsByTariff = useMemo(() => {
    const grouped = new Map<number, string[]>()

    for (const crew of crews) {
      if (crew.tariffId === null) continue

      grouped.set(crew.tariffId, [
        ...(grouped.get(crew.tariffId) ?? []),
        crew.name,
      ])
    }

    return grouped
  }, [crews])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TariffFormInput, any, TariffFormValues>({
    resolver: zodResolver(tariffFormSchema),
    defaultValues,
  })

  useEffect(() => {
    if (!editingTariff) {
      reset(defaultValues)
      return
    }

    reset({
      name: editingTariff.name,
      amountPerLeg: editingTariff.amountPerLeg,
    })
  }, [editingTariff, reset])

  function resetForm() {
    setEditingTariffId(null)
    setFormError('')
    reset(defaultValues)
  }

  const onSubmit = handleSubmit(async (values: TariffFormValues) => {
    setFormError('')

    try {
      if (editingTariffId) {
        await updateTariff(editingTariffId, values)
      } else {
        await addTariff(values)
      }

      resetForm()
    } catch (error) {
      setFormError(getErrorMessage(error, 'Could not save this tariff.'))
    }
  })

  async function removeTariff(tariffId: number) {
    if (editingTariffId === tariffId) {
      resetForm()
    }

    try {
      await deleteTariff(tariffId)
    } catch (error) {
      setFormError(getErrorMessage(error, 'Could not remove this tariff.'))
    }
  }

  return (
    <section
      className={cn(
        'grid gap-6',
        'grid-cols-[minmax(0,1fr)]',
        canCreateTariff && 'xl:grid-cols-[380px_minmax(0,1fr)]',
      )}
    >
      {canCreateTariff && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>
                {editingTariff ? 'Edit Tariff' : 'Add Tariff'}
              </CardTitle>
            </div>

            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Coins className="size-5" />
            </div>
          </CardHeader>

          <form className="mt-2 space-y-5" onSubmit={onSubmit}>
            <Field label="Name" htmlFor="name" error={errors.name?.message}>
              <Input
                id="name"
                placeholder="City short haul"
                {...register('name')}
              />
            </Field>

            <Field
              label="Amount per leg (TJS)"
              htmlFor="amountPerLeg"
              error={errors.amountPerLeg?.message}
            >
              <Input
                id="amountPerLeg"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                {...register('amountPerLeg')}
              />
            </Field>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                type="submit"
                className="h-11 rounded-2xl px-5"
                disabled={isSubmitting}
              >
                {editingTariff ? (
                  <PencilLine className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                {editingTariff ? 'Save Changes' : 'Add Tariff'}
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

            {formError && (
              <p className="text-xs font-medium text-destructive">{formError}</p>
            )}
          </form>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Prices per trip</CardTitle>
            <CardDescription className="mt-2">
              {isLoading ? 'Loading…' : `${tariffs.length} tariffs available.`}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Per leg</TableHead>
                <TableHead className="text-right">Round trip</TableHead>
                <TableHead>Used by</TableHead>
                {(canUpdateTariff || canDeleteTariff) && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tariffs.map((tariff) => {
                const usedBy = crewsByTariff.get(tariff.id) ?? []

                return (
                  <TableRow key={tariff.id}>
                    <TableCell className="font-medium text-foreground">
                      {tariff.name}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground">
                      {formatCurrency(tariff.amountPerLeg)}
                    </TableCell>
                    {/* The everyday case spelled out, so nobody has to double it in
                        their head to sanity-check a sheet. */}
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(tariff.amountPerLeg * 2)}
                    </TableCell>
                    <TableCell>
                      {usedBy.length === 0 ? (
                        <span className="text-faint-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {usedBy.map((crewName) => (
                            <Badge key={crewName} variant="secondary">
                              {crewName}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    {(canUpdateTariff || canDeleteTariff) && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canUpdateTariff && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="rounded-full border-border text-accent-foreground"
                              title="Edit tariff"
                              onClick={() => setEditingTariffId(tariff.id)}
                            >
                              <PencilLine className="size-4" />
                            </Button>
                          )}
                          {canDeleteTariff && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="rounded-full"
                              title="Delete tariff"
                              disabled={usedBy.length > 0}
                              onClick={() => setDeletingTariffId(tariff.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}

              {!isLoading && tariffs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-faint-foreground"
                  >
                    No tariffs yet — every crew is priced by the kilometre.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deletingTariffId !== null}
        onOpenChange={(open) => !open && setDeletingTariffId(null)}
        title="Remove this tariff?"
        description="It disappears from the list crews are chosen from. Sheets already generated keep the amount they were settled at."
        onConfirm={() => {
          if (deletingTariffId !== null) {
            removeTariff(deletingTariffId)
          }
        }}
      />
    </section>
  )
}

interface FieldProps {
  label: string
  htmlFor: string
  error?: string
  children: ReactNode
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
