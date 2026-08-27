import { ConfirmDialog } from '@/components/confirm-dialog'
import { useCrews } from '@/features/crews/crews-context'
import type { MonthlySheet } from '@/lib/domain-types'
import { formatCurrency, formatMonthLabel } from '@/lib/format'

interface PaySheetDialogProps {
  /** The sheet awaiting settlement, or `null` while nothing is being paid. */
  sheet: MonthlySheet | null
  onClose: () => void
  onConfirm: (sheet: MonthlySheet) => void
}

/**
 * Releasing a crew's month cannot be undone, so it is confirmed the same way wherever it
 * is offered — Monthly Sheets and Payouts state the same amount, recipient and month.
 */
export function PaySheetDialog({
  sheet,
  onClose,
  onConfirm,
}: PaySheetDialogProps) {
  const { getCrewName } = useCrews()

  return (
    <ConfirmDialog
      open={sheet !== null}
      onOpenChange={(open) => !open && onClose()}
      tone="positive"
      confirmLabel="Mark as paid"
      title={sheet ? `Pay ${sheet.recipientFullname}?` : 'Pay this crew?'}
      description={
        sheet
          ? `This releases ${formatCurrency(sheet.totalPayable)} to the lead of ${getCrewName(
              sheet.crewId,
            )} for ${formatMonthLabel(sheet.year, sheet.month)}. The crew cannot be paid again for this month.`
          : ''
      }
      onConfirm={() => sheet && onConfirm(sheet)}
    />
  )
}
