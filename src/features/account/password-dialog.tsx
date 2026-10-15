import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'

import { passwordFormSchema } from './password-form'
import type { PasswordFormValues } from './password-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '@/lib/api-error'

const emptyForm: PasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

interface PasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  submitLabel: string
  askCurrentPassword: boolean
  onSubmit: (values: PasswordFormValues) => Promise<void>
}

export function PasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  askCurrentPassword,
  onSubmit,
}: PasswordDialogProps) {
  const [formError, setFormError] = useState('')
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema(askCurrentPassword)),
    defaultValues: emptyForm,
  })

  // Typed passwords must not survive the dialog being closed and opened for someone else.
  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) {
      reset(emptyForm)
      setFormError('')
    }

    onOpenChange(nextOpen)
  }

  const submit = handleSubmit(async (values) => {
    setFormError('')

    try {
      await onSubmit(values)
      changeOpen(false)
    } catch (error) {
      setFormError(getErrorMessage(error, 'Could not save the password.'))
    }
  })

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit} noValidate>
          {askCurrentPassword && (
            <PasswordField
              label="Current password"
              htmlFor="currentPassword"
              error={errors.currentPassword?.message}
            >
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                {...register('currentPassword')}
              />
            </PasswordField>
          )}

          <PasswordField
            label="New password"
            htmlFor="newPassword"
            error={errors.newPassword?.message}
          >
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              {...register('newPassword')}
            />
          </PasswordField>

          <PasswordField
            label="Repeat the new password"
            htmlFor="confirmPassword"
            error={errors.confirmPassword?.message}
          >
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
          </PasswordField>

          {formError && (
            <p className="text-xs font-medium text-destructive">{formError}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => changeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-full"
              disabled={isSubmitting}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface PasswordFieldProps {
  label: string
  htmlFor: string
  error?: string
  children: ReactNode
}

function PasswordField({
  label,
  htmlFor,
  error,
  children,
}: PasswordFieldProps) {
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
