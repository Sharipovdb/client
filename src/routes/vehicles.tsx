import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, Car, PencilLine, Plus, Trash2 } from 'lucide-react'
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
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useUsersByRole } from '@/features/employees/employees-context'
import { useVehicles } from '@/features/vehicles/vehicles-context'
import type { VehicleDraft } from '@/features/vehicles/vehicles-context'
import { getErrorMessage } from '@/lib/api-error'
import { useCapability } from '@/lib/use-capability'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/vehicles')({
  component: VehiclesPage,
})

const vehicleFormSchema = z.object({
  driverId: z.number().refine((val) => val !== 0, {
    message: 'Select a driver-lead',
  }),
  plate: z
    .string()
    .trim()
    .min(2, 'Plate number must contain at least 2 characters.'),
  seatCount: z.coerce.number().int().positive('Seat count must be at least 1.'),
  amortizationBasis: z.coerce
    .number()
    .nonnegative('Amortization basis cannot be negative.'),
})

type VehicleFormInput = z.input<typeof vehicleFormSchema>
type VehicleFormValues = z.output<typeof vehicleFormSchema>

const defaultValues: VehicleFormInput = {
  driverId: 0,
  plate: '',
  seatCount: 4,
  amortizationBasis: 0,
}

function VehiclesPage() {
  const { data: driverLeads = [] } = useUsersByRole('DriverLead')
  const { vehicles, isLoading, addVehicle, updateVehicle, deleteVehicle } =
    useVehicles()
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null)
  const [formError, setFormError] = useState('')
  const [deletingVehicleId, setDeletingVehicleId] = useState<number | null>(
    null,
  )

  const canCreateVehicle = useCapability('createVehicle')
  const canUpdateVehicle = useCapability('updateVehicle')
  const canDeleteVehicle = useCapability('deleteVehicle')

  const driverLeadsWithoutVehicle = useMemo(
    () =>
      driverLeads.filter(
        (employee) =>
          !vehicles.some((vehicle) => vehicle.driverId === employee.id),
      ),
    [driverLeads, vehicles],
  )

  const editingVehicle =
    editingVehicleId === null
      ? null
      : (vehicles.find((vehicle) => vehicle.id === editingVehicleId) ?? null)

  const availableDriverOptions = useMemo(
    () =>
      driverLeads.filter(
        (employee) =>
          employee.id === editingVehicle?.driverId ||
          !vehicles.some((vehicle) => vehicle.driverId === employee.id),
      ),
    [driverLeads, vehicles, editingVehicle],
  )

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormInput, any, VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues,
  })

  useEffect(() => {
    if (!editingVehicle) {
      reset(defaultValues)
      return
    }

    reset({
      driverId: editingVehicle.driverId,
      plate: editingVehicle.plate,
      seatCount: editingVehicle.seatCount,
      amortizationBasis: editingVehicle.amortizationBasis,
    })
  }, [editingVehicle, reset])

  function resetForm() {
    setEditingVehicleId(null)
    setFormError('')
    reset(defaultValues)
  }

  const onSubmit = handleSubmit(async (values: VehicleDraft) => {
    setFormError('')

    try {
      if (editingVehicleId) {
        await updateVehicle(editingVehicleId, values)
      } else {
        await addVehicle(values)
      }

      resetForm()
    } catch (error) {
      setFormError(getErrorMessage(error, 'Could not save this vehicle.'))
    }
  })

  async function removeVehicle(vehicleId: number) {
    if (editingVehicleId === vehicleId) {
      resetForm()
    }

    try {
      await deleteVehicle(vehicleId)
    } catch (error) {
      setFormError(getErrorMessage(error, 'Could not remove this vehicle.'))
    }
  }

  function employeeName(employeeId: number) {
    const employee = driverLeads.find(
      (candidate) => candidate.id === employeeId,
    )
    return employee ? employee.fullname : 'Unknown'
  }

  return (
    <section
      className={cn(
        'grid gap-6',
        'grid-cols-[minmax(0,1fr)]',
        canCreateVehicle && 'xl:grid-cols-[380px_minmax(0,1fr)]',
      )}
    >
      {canCreateVehicle && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>
                {editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
              </CardTitle>
            </div>

            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Car className="size-5" />
            </div>
          </CardHeader>

          <form className="mt-2 space-y-5" onSubmit={onSubmit}>
            <Field
              label="Driver-Lead"
              htmlFor="driverId"
              error={errors.driverId?.message}
            >
              <Select
                id="driverId"
                {...register('driverId', { valueAsNumber: true })}
              >
                <option value={0}>Select driver-lead…</option>
                {availableDriverOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullname}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Plate Number"
              htmlFor="plate"
              error={errors.plate?.message}
            >
              <Input
                id="plate"
                placeholder="01 T 123 AA"
                {...register('plate')}
              />
            </Field>

            <Field
              label="Seat Count"
              htmlFor="seatCount"
              error={errors.seatCount?.message}
            >
              <Input
                id="seatCount"
                type="number"
                min="1"
                step="1"
                {...register('seatCount')}
              />
            </Field>

            <Field
              label="Amortization Basis (TJS / month)"
              htmlFor="amortizationBasis"
              error={errors.amortizationBasis?.message}
            >
              <Input
                id="amortizationBasis"
                type="number"
                min="0"
                step="1"
                {...register('amortizationBasis')}
              />
            </Field>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                type="submit"
                className="h-11 rounded-2xl px-5"
                disabled={isSubmitting}
              >
                {editingVehicle ? (
                  <PencilLine className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                {editingVehicle ? 'Save Changes' : 'Add Vehicle'}
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

            {availableDriverOptions.length === 0 && !editingVehicle && (
              <p className="text-xs font-medium text-warning">
                Every Driver-Lead already has a vehicle assigned.
              </p>
            )}

            {formError && (
              <p className="text-xs font-medium text-destructive">{formError}</p>
            )}
          </form>
        </Card>
      )}

      <div className="space-y-6">
        {driverLeadsWithoutVehicle.length > 0 && (
          <Card className="border-warning/30 bg-warning/10">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-semibold text-warning">
                  Driver-Leads without a vehicle
                </p>
                <p className="mt-1 text-sm text-warning">
                  {driverLeadsWithoutVehicle
                    .map((employee) => employee.fullname)
                    .join(', ')}
                </p>
              </div>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader className="flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Fleet</CardTitle>
              <CardDescription className="mt-2">
                {isLoading
                  ? 'Loading…'
                  : `${vehicles.length} vehicles registered.`}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver-Lead</TableHead>
                  <TableHead>Plate</TableHead>
                  <TableHead>Seats</TableHead>
                  <TableHead>Amortization</TableHead>
                  {(canUpdateVehicle || canDeleteVehicle) && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-medium text-foreground">
                      {employeeName(vehicle.driverId)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{vehicle.plate}</Badge>
                    </TableCell>
                    <TableCell>{vehicle.seatCount}</TableCell>
                    <TableCell>{vehicle.amortizationBasis} TJS / mo</TableCell>
                    {(canUpdateVehicle || canDeleteVehicle) && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canUpdateVehicle && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="rounded-full border-border text-accent-foreground"
                              title="Edit vehicle"
                              onClick={() => setEditingVehicleId(vehicle.id)}
                            >
                              <PencilLine className="size-4" />
                            </Button>
                          )}
                          {canDeleteVehicle && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="rounded-full"
                              title="Delete vehicle"
                              onClick={() => setDeletingVehicleId(vehicle.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}

                {!isLoading && vehicles.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-10 text-center text-faint-foreground"
                    >
                      No vehicles registered yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={deletingVehicleId !== null}
        onOpenChange={(open) => !open && setDeletingVehicleId(null)}
        title="Delete this vehicle?"
        description="This action cannot be undone."
        onConfirm={() => {
          if (deletingVehicleId !== null) {
            removeVehicle(deletingVehicleId)
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
