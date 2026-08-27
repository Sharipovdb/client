import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import {
  AlertTriangle,
  Bus,
  PencilLine,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { useEffect, useState, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { CrewMembershipDialog } from '@/features/crews/crew-membership-dialog'
import { useCrewMemberships } from '@/features/crews/crew-memberships-context'
import { useCrews } from '@/features/crews/crews-context'
import { useTariffs } from '@/features/tariffs/tariffs-context'
import type { CrewDraft } from '@/features/crews/crews-context'
import { useEmployees } from '@/features/employees/employees-context'
import { useTransportRoutes } from '@/features/routes/routes-context'
import { useVehicles } from '@/features/vehicles/vehicles-context'
import { getErrorMessage } from '@/lib/api-error'
import type { Crew } from '@/lib/domain-types'
import { formatCurrency, formatKm } from '@/lib/format'

export const Route = createFileRoute('/crews')({
  component: CrewsPage,
})

const crewFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Crew name must contain at least 2 characters.'),
    routeId: z.number(),
    // 0 is the "None" entry in the picker: no tariff, so the crew is measured along a
    // route instead.
    tariffId: z.number(),
    driverLeadId: z.number().nullable(),
    crewLeadId: z.number().nullable(),
    seatCapacity: z.coerce
      .number()
      .int()
      .positive('Seat capacity must be at least 1.'),
  })
  .superRefine((values, ctx) => {
    // How this crew's driving becomes money: measured along a route, or paid at a flat
    // tariff per leg. A route is only needed when no tariff was picked.
    if (!values.tariffId && !values.routeId) {
      ctx.addIssue({
        code: 'custom',
        path: ['routeId'],
        message: 'Select a route, or pick a tariff to pay per trip.',
      })
    }

    // A crew is led by exactly one person, so a lead is not optional — and the backend
    // says so too. Catching it here keeps the form from firing a mutation that can only
    // come back as an error, and puts the answer next to the picker instead.
    if (values.driverLeadId || values.crewLeadId) return

    // Switching the lead type clears the field it is not using, so only one of the two
    // pickers is ever on screen. The issue is raised against both keys, which is what
    // makes the message appear whichever one that is.
    for (const path of ['driverLeadId', 'crewLeadId'] as const) {
      ctx.addIssue({
        code: 'custom',
        path: [path],
        message: 'Select a lead for this crew.',
      })
    }
  })

type CrewFormInput = z.input<typeof crewFormSchema>
type CrewFormValues = z.output<typeof crewFormSchema>

const defaultValues: CrewFormInput = {
  name: '',
  routeId: 0,
  tariffId: 0,
  driverLeadId: null,
  crewLeadId: null,
  seatCapacity: 4,
}

type LeadType = 'driverLead' | 'crewLead'

function CrewsPage() {
  const { employees } = useEmployees()
  const { routes } = useTransportRoutes()
  const { getVehicleByDriverId } = useVehicles()
  const { crews, isLoading, addCrew, updateCrew, deleteCrew } = useCrews()
  const { tariffs } = useTariffs()
  const { memberships, getActiveMembersForCrew } = useCrewMemberships()

  const [editingCrewId, setEditingCrewId] = useState<number | null>(null)
  const [leadType, setLeadType] = useState<LeadType>('driverLead')
  const [membershipCrewId, setMembershipCrewId] = useState<number | null>(null)
  const [formError, setFormError] = useState('')
  const [deletingCrewId, setDeletingCrewId] = useState<number | null>(null)

  const editingCrew =
    editingCrewId === null
      ? null
      : (crews.find((crew) => crew.id === editingCrewId) ?? null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CrewFormInput, any, CrewFormValues>({
    resolver: zodResolver(crewFormSchema),
    defaultValues,
  })

  const driverLeadId = watch('driverLeadId')
  const crewLeadId = watch('crewLeadId')
  const selectedTariffId = watch('tariffId')

  const leads = leadType === 'driverLead' ? driverLeadId : crewLeadId

  const unassignedEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          !memberships.some(
            (membership) =>
              membership.employeeId === employee.id && membership.isActive,
          ),
      ),
    [employees, memberships],
  )

  useEffect(() => {
    if (!editingCrew) {
      reset(defaultValues)
      return
    }

    if (editingCrew.driverLeadId) {
      setLeadType('driverLead')
    } else {
      setLeadType('crewLead')
    }

    reset({
      name: editingCrew.name,
      // Whichever basis the crew is not on reads as 0 — the "None"/"unset" entry.
      routeId: editingCrew.routeId ?? 0,
      tariffId: editingCrew.tariffId ?? 0,
      driverLeadId: editingCrew.driverLeadId,
      crewLeadId: editingCrew.crewLeadId,
      seatCapacity: editingCrew.seatCapacity,
    })
  }, [editingCrew, reset])

  useEffect(() => {
    if (driverLeadId === null || !driverLeadId) {
      return
    }

    const vehicle = getVehicleByDriverId(driverLeadId)

    if (vehicle) {
      setValue('seatCapacity', vehicle.seatCount)
    }
    // Only re-run when the selected driver-lead (or lead type) changes, not on every render.
  }, [driverLeadId])

  function resetForm() {
    setEditingCrewId(null)
    setFormError('')
    reset(defaultValues)
  }

  const onSubmit = handleSubmit(async (values: CrewDraft) => {
    setFormError('')

    try {
      // Picking a tariff is what retires the route, and vice versa — the backend refuses
      // a crew that names both, so only the chosen one is sent.
      const draft = {
        ...values,
        routeId: values.tariffId ? null : values.routeId,
        tariffId: values.tariffId || null,
      }

      if (editingCrewId) {
        await updateCrew(editingCrewId, draft)
      } else {
        await addCrew(draft)
      }

      resetForm()
    } catch (error) {
      setFormError(getErrorMessage(error, 'Could not save this crew.'))
    }
  })

  async function removeCrew(crewId: number) {
    if (editingCrewId === crewId) {
      resetForm()
    }

    try {
      await deleteCrew(crewId)
    } catch (error) {
      setFormError(getErrorMessage(error, 'Could not remove this crew.'))
    }
  }

  // A driven day is worth this route's distance each way, so the crew card states it
  // rather than leaving the number to be discovered on the Routes page.
  /** How the crew is priced: the tariff it was put on, or the route it is measured along. */
  function pricingLabel(crew: Crew) {
    if (crew.tariffId !== null) {
      const tariff = tariffs.find((candidate) => candidate.id === crew.tariffId)

      return tariff
        ? `${tariff.name} · ${formatCurrency(tariff.amountPerLeg)} per leg`
        : 'Paid per trip'
    }

    const route = routes.find((candidate) => candidate.id === crew.routeId)

    return route ? `${route.name} · ${formatKm(route.distanceKm)} each way` : 'Unknown route'
  }

  function employeeName(employeeId: number | null) {
    const employee = employees.find((candidate) => candidate.id === employeeId)
    return employee ? employee.fullname : 'Unknown'
  }

  const membershipCrew = membershipCrewId
    ? (crews.find((crew) => crew.id === membershipCrewId) ?? null)
    : null

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardEyebrow>Crews</CardEyebrow>
              <CardTitle className="mt-2">
                {editingCrew ? 'Edit Crew' : 'Add Crew'}
              </CardTitle>
              <CardDescription className="mt-2">
                A crew has a name, a lead — either a Driver-Lead or a Crew-Lead
                — and a route, which sets what a day travelled by car is worth.
                A crew on a tariff is paid a flat amount per trip instead and
                needs no route. The lead is who the crew's month is paid to.
              </CardDescription>
            </div>

            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <Bus className="size-5" />
            </div>
          </CardHeader>

          <form className="mt-2 space-y-5" onSubmit={onSubmit}>
            <Field
              label="Crew Name"
              htmlFor="name"
              error={errors.name?.message}
            >
              <Input
                id="name"
                placeholder="Karakum Site Crew A"
                {...register('name')}
              />
            </Field>

            {/* Picking a tariff is what decides how this crew's driving becomes
                money: a flat amount per leg, instead of kilometres along a route. */}
            <Field label="Tariff" htmlFor="tariffId">
              <Select
                id="tariffId"
                {...register('tariffId', { valueAsNumber: true })}
              >
                <option value={0}>None — measure by route</option>
                {tariffs.map((tariff) => (
                  <option key={tariff.id} value={tariff.id}>
                    {tariff.name} ({formatCurrency(tariff.amountPerLeg)} per
                    leg)
                  </option>
                ))}
              </Select>
            </Field>

            {/* Only asked for when no tariff was picked: a crew paid per trip is not
                measured, so a route would price nothing for it. */}
            {!selectedTariffId && (
              <Field
                label="Route"
                htmlFor="routeId"
                error={errors.routeId?.message}
              >
                <Select
                  id="routeId"
                  {...register('routeId', { valueAsNumber: true })}
                >
                  <option value={0}>Select route…</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name} ({route.distanceKm} km)
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Lead Type</p>
              <div className="grid grid-cols-2 gap-2">
                {(['driverLead', 'crewLead'] as LeadType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setLeadType(type)
                      setValue('driverLeadId', null)
                      setValue('crewLeadId', null)
                    }}
                    className={`rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
                      leadType === type
                        ? 'border-sky-600 bg-sky-600 text-white'
                        : 'border-sky-100 bg-white text-slate-600 hover:border-sky-200'
                    }`}
                  >
                    {type === 'driverLead' ? 'Driver-Lead' : 'Crew-Lead'}
                  </button>
                ))}
              </div>
            </div>

            <Field
              label={leadType === 'driverLead' ? 'Driver Lead' : 'Manager Lead'}
              htmlFor="lead"
              error={
                leadType === 'driverLead'
                  ? errors.driverLeadId?.message
                  : errors.crewLeadId?.message
              }
            >
              <Select
                id="lead"
                value={leads ?? 0}
                onChange={(e) => {
                  const id = Number(e.target.value)

                  if (leadType === 'driverLead') {
                    setValue('driverLeadId', id || null)
                    setValue('crewLeadId', null)
                  } else {
                    setValue('crewLeadId', id || null)
                    setValue('driverLeadId', null)
                  }
                }}
              >
                <option value={0}>Select leader…</option>

                {unassignedEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullname}
                  </option>
                ))}
              </Select>

              {employees.length === 0 && (
                <p className="text-xs text-amber-600">
                  No employees available.
                </p>
              )}
            </Field>

            <Field
              label="Seat Capacity"
              htmlFor="seatCapacity"
              error={errors.seatCapacity?.message}
            >
              <Input
                id="seatCapacity"
                type="number"
                min="1"
                step="1"
                {...register('seatCapacity')}
              />
              {leadType === 'driverLead' && (
                <p className="text-xs text-slate-400">
                  Defaults from the driver's vehicle — still editable.
                </p>
              )}
            </Field>

            {formError && (
              <p className="text-xs font-medium text-red-500">{formError}</p>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                type="submit"
                className="h-11 rounded-2xl bg-sky-600 px-5 text-white hover:bg-sky-700"
                disabled={isSubmitting}
              >
                {editingCrew ? (
                  <PencilLine className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                {editingCrew ? 'Save Changes' : 'Add Crew'}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-2xl border-sky-100 px-5 text-slate-700"
                onClick={resetForm}
              >
                Clear Form
              </Button>
            </div>
          </form>
        </Card>

        <div className="grid gap-5 sm:grid-cols-2">
          {crews.map((crew) => {
            const activeMembers = getActiveMembersForCrew(crew.id)
            const isOverflowing = activeMembers.length > crew.seatCapacity

            return (
              <Card key={crew.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge variant={crew.driverLeadId ? 'success' : 'default'}>
                      {crew.driverLeadId ? 'Driver-Lead' : 'Manager-Lead'}
                    </Badge>
                    <h3 className="mt-2 text-lg font-semibold text-slate-950">
                      {crew.name}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {pricingLabel(crew)}
                    </p>
                  </div>

                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="rounded-full border-sky-100 text-sky-700"
                      onClick={() => setEditingCrewId(crew.id)}
                    >
                      <PencilLine className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      className="rounded-full"
                      onClick={() => setDeletingCrewId(crew.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 text-sm text-slate-600">
                  <p>
                    <span className="font-medium text-slate-800">Lead:</span>{' '}
                    {crew.driverLeadId
                      ? employeeName(crew.driverLeadId)
                      : employeeName(crew.crewLeadId)}
                  </p>
                  <p>
                    <span className="font-medium text-slate-800">Seats:</span>{' '}
                    {activeMembers.length} / {crew.seatCapacity}
                  </p>
                </div>

                {isOverflowing && (
                  <Badge variant="warning" className="mt-3 w-fit">
                    <AlertTriangle className="size-3" />
                    Overflow — arrange extra taxi/vehicle
                  </Badge>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 h-10 w-full rounded-2xl border-sky-100 text-sky-700"
                  onClick={() => setMembershipCrewId(crew.id)}
                >
                  <Users className="size-4" />
                  Manage Members
                </Button>
              </Card>
            )
          })}

          {!isLoading && crews.length === 0 && (
            <Card className="sm:col-span-2">
              <p className="py-10 text-center text-slate-400">
                No crews yet — add the first one.
              </p>
            </Card>
          )}
        </div>
      </div>

      {membershipCrew && (
        <CrewMembershipDialog
          crew={membershipCrew}
          open={membershipCrewId !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setMembershipCrewId(null)
            }
          }}
        />
      )}

      <ConfirmDialog
        open={deletingCrewId !== null}
        onOpenChange={(open) => !open && setDeletingCrewId(null)}
        title="Delete this crew?"
        description="This action cannot be undone."
        onConfirm={() => {
          if (deletingCrewId !== null) {
            removeCrew(deletingCrewId)
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
      <label className="text-sm font-medium text-slate-700" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error && <p className="text-xs font-medium text-red-500">{error}</p>}
    </div>
  )
}
