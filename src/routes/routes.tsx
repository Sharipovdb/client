import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { Map, PencilLine, Plus, Route as RouteIcon, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardEyebrow,
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
import { useTransportRoutes } from '@/features/routes/routes-context'
import type { TransportRouteDraft } from '@/features/routes/routes-context'
import { getErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { useCapability } from '@/lib/use-capability'

export const Route = createFileRoute('/routes')({
  component: RoutesPage,
})

const routeFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Route name must contain at least 2 characters.'),
  distanceKm: z.coerce.number().positive('Distance must be greater than 0.'),
})

// z.coerce.number() gives distanceKm an `unknown` input type and a `number` output
// type — useForm needs both generics (input for defaultValues/reset, output for the
// handleSubmit callback) or TS can't reconcile the resolver's type.
type RouteFormInput = z.input<typeof routeFormSchema>
type RouteFormValues = z.output<typeof routeFormSchema>

const defaultValues: RouteFormInput = {
  name: '',
  distanceKm: 0,
}

function RoutesPage() {
  const { routes, isLoading, addRoute, updateRoute, deleteRoute } =
    useTransportRoutes()
  const [editingRouteId, setEditingRouteId] = useState<number | null>(null)
  const [formError, setFormError] = useState('')
  const [deletingRouteId, setDeletingRouteId] = useState<number | null>(null)

  const canCreateRoute = useCapability('createRoute')
  const canUpdateRoute = useCapability('updateRoute')
  const canDeleteRoute = useCapability('deleteRoute')

  const sortedRoutes = useMemo(
    () =>
      [...routes].sort((left, right) => left.name.localeCompare(right.name)),
    [routes],
  )

  const editingRoute =
    editingRouteId === null
      ? null
      : (routes.find((route) => route.id === editingRouteId) ?? null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RouteFormInput, any, RouteFormValues>({
    resolver: zodResolver(routeFormSchema),
    defaultValues,
  })

  useEffect(() => {
    if (!editingRoute) {
      reset(defaultValues)
      return
    }

    reset({ name: editingRoute.name, distanceKm: editingRoute.distanceKm })
  }, [editingRoute, reset])

  function resetForm() {
    setEditingRouteId(null)
    setFormError('')
    reset(defaultValues)
  }

  const onSubmit = handleSubmit(async (values: TransportRouteDraft) => {
    setFormError('')

    try {
      if (editingRouteId) {
        console.log(editingRouteId)
        await updateRoute(editingRouteId, values)
      } else {
        await addRoute(values)
      }

      resetForm()
    } catch (error) {
      setFormError(getErrorMessage(error, 'Could not save this route.'))
    }
  })

  async function removeRoute(routeId: number) {
    if (editingRouteId === routeId) {
      resetForm()
    }

    try {
      await deleteRoute(routeId)
    } catch (error) {
      setFormError(getErrorMessage(error, 'Could not remove this route.'))
    }
  }

  return (
    <section
      className={cn(
        'grid gap-6',
        'grid-cols-[minmax(0,1fr)]',
        canCreateRoute && 'xl:grid-cols-[380px_minmax(0,1fr)]',
      )}
    >
      {canCreateRoute && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardEyebrow>Routes</CardEyebrow>
              <CardTitle className="mt-2">
                {editingRoute ? 'Edit Route' : 'Add Route'}
              </CardTitle>
              <CardDescription className="mt-2">
                The standard one-way distance is used as the default commute km
                for driven days.
              </CardDescription>
            </div>

            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <Map className="size-5" />
            </div>
          </CardHeader>

          <form className="mt-2 space-y-5" onSubmit={onSubmit}>
            <Field
              label="Route Name"
              htmlFor="name"
              error={errors.name?.message}
            >
              <Input
                id="name"
                placeholder="Karakum Industrial Site"
                {...register('name')}
              />
            </Field>

            <Field
              label="Standard Distance (km, one-way)"
              htmlFor="distanceKm"
              error={errors.distanceKm?.message}
            >
              <Input
                id="distanceKm"
                type="number"
                step="0.1"
                min="0"
                placeholder="42"
                {...register('distanceKm')}
              />
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
                {editingRoute ? (
                  <PencilLine className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                {editingRoute ? 'Save Changes' : 'Add Route'}
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
      )}

      <Card>
        <CardHeader className="flex-col gap-4 border-b border-sky-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardEyebrow>Routes list</CardEyebrow>
            <CardTitle className="mt-2">Standard Commute Distances</CardTitle>
            <CardDescription className="mt-2">
              {isLoading
                ? 'Loading…'
                : `${sortedRoutes.length} routes configured.`}
            </CardDescription>
          </div>

          <div className="hidden items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 sm:inline-flex">
            <RouteIcon className="size-4" />
            One-way distance
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Distance (km)</TableHead>
                {(canUpdateRoute || canDeleteRoute) && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRoutes.map((route) => (
                <TableRow key={route.name}>
                  <TableCell className="font-medium text-slate-900">
                    {route.name}
                  </TableCell>
                  <TableCell>{route.distanceKm} km</TableCell>
                  {(canUpdateRoute || canDeleteRoute) && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canUpdateRoute && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="rounded-full border-sky-100 text-sky-700"
                            onClick={() => setEditingRouteId(route.id)}
                          >
                            <PencilLine className="size-4" />
                          </Button>
                        )}
                        {canDeleteRoute && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="rounded-full"
                            onClick={() => setDeletingRouteId(route.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}

              {!isLoading && sortedRoutes.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-10 text-center text-slate-400"
                  >
                    No routes yet — add the first one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deletingRouteId !== null}
        onOpenChange={(open) => !open && setDeletingRouteId(null)}
        title="Delete this route?"
        description="This action cannot be undone."
        onConfirm={() => {
          if (deletingRouteId !== null) {
            removeRoute(deletingRouteId)
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
