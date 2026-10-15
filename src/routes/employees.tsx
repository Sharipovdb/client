import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import {
  Briefcase,
  KeyRound,
  PencilLine,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { useEffect, useState, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
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
import { PasswordDialog } from '@/features/account/password-dialog'
import { useEmployees } from '@/features/employees/employees-context'
import type { EmployeeDraft } from '@/features/employees/employees-context'
import { getErrorMessage } from '@/lib/api-error'
import { passwordSchema } from '@/lib/password-rules'
import { useCapability } from '@/lib/use-capability'
import {
  employeeRoleLabels,
  employeeRolesAdd,
  employeeRoles,
} from '@/lib/domain-types'
import type { EmployeeRole } from '@/lib/domain-types'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from '@/components/ui/combobox'

export const Route = createFileRoute('/employees')({
  component: EmployeesPage,
})

const employeeFormSchema = z.object({
  userName: z
    .string()
    .trim()
    .min(2, 'First name must contain at least 2 characters.'),
  email: z.email().trim().nullable(),
  fullname: z
    .string()
    .trim()
    .min(2, 'Full name must contain at least 2 characters.'),
  password: passwordSchema.optional(),
  phoneNumber: z
    .string()
    .trim()
    .min(8, 'Phone number must contain at least 8 characters.'),
  telegramId: z
    .string()
    .trim()
    .min(2, 'Telegram handle must contain at least 2 characters.')
    .nullable(),
  roles: z.array(z.enum(employeeRoles)),
})

type EmployeeFormValues = z.infer<typeof employeeFormSchema>

const defaultValues: EmployeeFormValues = {
  userName: '',
  email: '',
  fullname: '',
  password: '',
  phoneNumber: '',
  telegramId: '',
  roles: ['Worker'],
}

const roleBadgeVariant: Record<
  EmployeeRole,
  'default' | 'secondary' | 'success' | 'warning'
> = {
  Admin: 'warning',
  RouteManager: 'warning',
  CrewLead: 'default',
  DriverLead: 'success',
  Worker: 'secondary',
  Accountant: 'default',
}

function EmployeesPage() {
  const {
    employees,
    isLoading,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    resetPassword,
  } = useEmployees()
  const canResetPassword = useCapability('resetPassword')
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(
    null,
  )
  const [roleFilter, setRoleFilter] = useState<EmployeeRole | 'all'>('all')
  const [formError, setFormError] = useState('')
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<number | null>(
    null,
  )
  const [resettingEmployeeId, setResettingEmployeeId] = useState<number | null>(
    null,
  )
  const resettingEmployee = employees.find(
    (employee) => employee.id === resettingEmployeeId,
  )

  const filteredEmployees = useMemo(() => {
    const scoped =
      roleFilter === 'all'
        ? employees
        : employees.filter((employee) => employee.roles.includes(roleFilter))

    return [...scoped].sort((left, right) =>
      left.fullname.localeCompare(right.fullname),
    )
  }, [employees, roleFilter])

  const editingEmployee =
    editingEmployeeId === null
      ? null
      : (employees.find((employee) => employee.id === editingEmployeeId) ??
        null)

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues,
  })

  useEffect(() => {
    if (!editingEmployee) {
      reset(defaultValues)
      return
    }

    reset({
      userName: editingEmployee.userName,
      email: editingEmployee.email,
      fullname: editingEmployee.fullname,
      phoneNumber: editingEmployee.phoneNumber,
      telegramId: editingEmployee.telegramId,
      roles: editingEmployee.roles,
    })
  }, [editingEmployee, reset])

  function resetForm() {
    setEditingEmployeeId(null)
    setFormError('')
    reset(defaultValues)
  }

  const onSubmit = handleSubmit(async (values: EmployeeDraft) => {
    setFormError('')

    try {
      if (editingEmployeeId) {
        await updateEmployee(editingEmployeeId, values)
      } else {
        await addEmployee(values)
      }

      resetForm()
    } catch (error) {
      setFormError(getErrorMessage(error, 'Could not save this employee.'))
    }
  })

  async function removeEmployee(employeeId: number) {
    if (editingEmployeeId === employeeId) {
      resetForm()
    }

    try {
      await deleteEmployee(employeeId)
    } catch (error) {
      setFormError(getErrorMessage(error, 'Could not remove this employee.'))
    }
  }

  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>
              {editingEmployee ? 'Edit Employee' : 'Add Employee'}
            </CardTitle>
          </div>

          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Briefcase className="size-5" />
          </div>
        </CardHeader>

        <form className="mt-2 space-y-5" onSubmit={onSubmit}>
          <Field
            label="User Name"
            htmlFor="userName"
            error={errors.userName?.message}
          >
            <Input
              id="firstName"
              placeholder="aziz"
              {...register('userName')}
            />
          </Field>

          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              placeholder="example@pt.com"
              {...register('email')}
            />
          </Field>

          <Field
            label="Full Name"
            htmlFor="fullname"
            error={errors.fullname?.message}
          >
            <Input
              id="fullname"
              placeholder="Aziz Azizov"
              {...register('fullname')}
            />
          </Field>

          {!editingEmployee && (
            <Field
              label="Password"
              htmlFor="password"
              error={errors.password?.message}
            >
              <Input
                id="password"
                placeholder="••••••••"
                {...register('password')}
              />
            </Field>
          )}

          <Field
            label="Phone Number"
            htmlFor="phoneNumber"
            error={errors.phoneNumber?.message}
          >
            <Input
              id="phoneNumber"
              placeholder="+992900000123"
              {...register('phoneNumber')}
            />
          </Field>

          <Field
            label="Telegram ID"
            htmlFor="telegramId"
            error={errors.telegramId?.message}
          >
            <Input
              id="telegramId"
              placeholder="12345"
              {...register('telegramId')}
            />
          </Field>

          <Field label="Roles" htmlFor="roles" error={errors.roles?.message}>
            <Controller
              control={control}
              name="roles"
              render={({ field }) => (
                <Combobox
                  id="roles"
                  multiple
                  value={field.value}
                  onValueChange={(roles) => {
                    const next = roles.includes('Worker')
                      ? roles
                      : [...roles, 'Worker']

                    field.onChange(next)
                  }}
                >
                  <ComboboxChips>
                    <ComboboxValue>
                      {field.value.map((role) => (
                        <ComboboxChip
                          key={role}
                          showRemove={
                            role !== 'Worker' &&
                            role !== 'CrewLead' &&
                            role !== 'DriverLead'
                          }
                        >
                          {role}
                        </ComboboxChip>
                      ))}
                    </ComboboxValue>

                    <ComboboxChipsInput placeholder="Select roles" />
                  </ComboboxChips>

                  <ComboboxContent>
                    <ComboboxList>
                      {employeeRolesAdd.map((role) => (
                        <ComboboxItem key={role} value={role}>
                          {role}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              )}
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
              {editingEmployee ? (
                <PencilLine className="size-4" />
              ) : (
                <Plus className="size-4" />
              )}
              {editingEmployee ? 'Save Changes' : 'Add Employee'}
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

      <Card>
        <CardHeader className="flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription className="mt-2">
              {isLoading
                ? 'Loading…'
                : `${employees.length} of ${employees.length} employees shown.`}
            </CardDescription>
          </div>

          <div className="flex w-full items-center gap-3 sm:w-auto">
            <Select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value as EmployeeRole | 'all')
              }
              className="w-full sm:w-48"
            >
              <option value="all">All roles</option>
              {employeeRoles.map((role) => (
                <option key={role} value={role}>
                  {employeeRoleLabels[role]}
                </option>
              ))}
            </Select>

            <div className="hidden items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-medium text-accent-foreground sm:inline-flex">
              <Users className="size-4" />
              {employees.length} total
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Telegram</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium text-foreground">
                    {employee.fullname}
                  </TableCell>
                  <TableCell>
                    {employee.roles.map((role) => (
                      <Badge
                        key={role}
                        className="mx-0.5"
                        variant={roleBadgeVariant[role]}
                      >
                        {employeeRoleLabels[role]}
                      </Badge>
                    ))}
                  </TableCell>
                  <TableCell>{employee.phoneNumber}</TableCell>
                  <TableCell>{employee.telegramId}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="rounded-full border-border text-accent-foreground"
                        title="Edit employee"
                        onClick={() => setEditingEmployeeId(employee.id)}
                      >
                        <PencilLine className="size-4" />
                      </Button>
                      {canResetPassword && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="rounded-full border-border text-accent-foreground"
                          title="Reset password"
                          onClick={() => setResettingEmployeeId(employee.id)}
                        >
                          <KeyRound className="size-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="rounded-full"
                        title="Delete employee"
                        onClick={() => setDeletingEmployeeId(employee.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {!isLoading && employees.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-faint-foreground"
                  >
                    No employees yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deletingEmployeeId !== null}
        onOpenChange={(open) => !open && setDeletingEmployeeId(null)}
        title="Delete this employee?"
        description="This action cannot be undone."
        onConfirm={() => {
          if (deletingEmployeeId !== null) {
            removeEmployee(deletingEmployeeId)
          }
        }}
      />

      {/* Only the password changes: the employee keeps their id, profile, roles and
          everything logged under them, and is signed out everywhere. */}
      <PasswordDialog
        open={resettingEmployee !== undefined}
        onOpenChange={(open) => !open && setResettingEmployeeId(null)}
        title={`Reset the password of ${resettingEmployee?.fullname ?? 'this employee'}`}
        description="Pass the new password on to them. They will be signed out of every device and sign in again with it."
        submitLabel="Reset password"
        askCurrentPassword={false}
        onSubmit={async ({ newPassword }) => {
          if (resettingEmployee) {
            await resetPassword(resettingEmployee.id, newPassword)
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
