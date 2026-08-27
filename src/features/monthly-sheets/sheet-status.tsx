import { Badge } from '@/components/ui/badge'
import type { MonthlySheet } from '@/lib/domain-types'

/**
 * A sheet has exactly one state, and every screen has to name it the same way: it is a
 * Draft until it is signed off, Confirmed once it is, and Paid once the money has been
 * released. Confirming and paying are two different events, so a confirmed sheet must
 * never already read as paid.
 */
const sheetStatuses = {
  draft: { label: 'Draft', variant: 'warning' },
  confirmed: { label: 'Confirmed', variant: 'default' },
  paid: { label: 'Paid', variant: 'success' },
} as const

export type SheetStatus = keyof typeof sheetStatuses

export function getSheetStatus(sheet: MonthlySheet): SheetStatus {
  if (sheet.isPaid) return 'paid'

  return sheet.isConfirmed ? 'confirmed' : 'draft'
}

export function SheetStatusBadge({ sheet }: { sheet: MonthlySheet }) {
  const { label, variant } = sheetStatuses[getSheetStatus(sheet)]

  return <Badge variant={variant}>{label}</Badge>
}

/**
 * Money is released once, on a signed-off sheet that actually owes something — the same
 * three conditions MarkMonthlyTransportSheetPaidCommand enforces server-side, so the
 * button is only offered where the backend would accept it.
 */
export function isPayable(sheet: MonthlySheet) {
  return sheet.isConfirmed && !sheet.isPaid && sheet.totalPayable > 0
}
