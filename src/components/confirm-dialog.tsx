import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * `tone` decides what the confirm button looks like *and* what it says by default.
 * Destructive red on a "Mark as paid" dialog reads as "Delete" no matter what the
 * title says, so the two are chosen together rather than left to each caller.
 */
type ConfirmTone = 'destructive' | 'positive'

const toneStyles: Record<ConfirmTone, string> = {
  destructive: 'bg-red-600 text-white hover:bg-red-700',
  positive: 'bg-emerald-600 text-white hover:bg-emerald-700',
}

const toneLabels: Record<ConfirmTone, string> = {
  destructive: 'Delete',
  positive: 'Confirm',
}

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  tone?: ConfirmTone
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  tone = 'destructive',
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction className={toneStyles[tone]} onClick={onConfirm}>
            {confirmLabel ?? toneLabels[tone]}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
