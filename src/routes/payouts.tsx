import { createFileRoute } from '@tanstack/react-router'
import { BadgeCheck, FileText, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { Period } from '@/components/month-picker'
import { MonthPicker } from '@/components/month-picker'
import { Button } from '@/components/ui/button'
import { Card, CardEyebrow, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePermissions } from '@/features/auth/use-permissions'
import { useCrews } from '@/features/crews/crews-context'
import { useMonthlySheets } from '@/features/monthly-sheets/monthly-sheets-context'
import { PaySheetDialog } from '@/features/monthly-sheets/pay-sheet-dialog'
import {
  isPayable,
  SheetStatusBadge,
} from '@/features/monthly-sheets/sheet-status'
import { useMonthlyReportPrinter } from '@/features/monthly-sheets/use-monthly-report-printer'
import { getErrorMessage } from '@/lib/api-error'
import type { MonthlySheet } from '@/lib/domain-types'
import {
  formatCurrency,
  formatKm,
  formatMonthLabel,
  getMonthYear,
} from '@/lib/format'

export const Route = createFileRoute('/payouts')({
  component: PayoutsPage,
})

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function PayoutsPage() {
  const { can } = usePermissions()
  const { getCrewName } = useCrews()
  const { sheets, isLoading, markSheetPaid } = useMonthlySheets()
  const printReport = useMonthlyReportPrinter()

  const [period, setPeriod] = useState<Period>(() =>
    getMonthYear(todayIsoDate()),
  )
  const [payingSheet, setPayingSheet] = useState<MonthlySheet | null>(null)
  const [actionError, setActionError] = useState('')

  const sheetsInPeriod = useMemo(
    () =>
      sheets
        .filter(
          (sheet) => sheet.year === period.year && sheet.month === period.month,
        )
        .sort((first, second) =>
          getCrewName(first.crewId).localeCompare(getCrewName(second.crewId)),
        ),
    [sheets, period, getCrewName],
  )

  // Money already released is excluded from what still has to be paid out.
  const grandTotal = sheetsInPeriod.reduce(
    (total, sheet) => total + sheet.totalPayable,
    0,
  )
  const outstandingTotal = sheetsInPeriod.reduce(
    (total, sheet) => (sheet.isPaid ? total : total + sheet.totalPayable),
    0,
  )

  async function handlePay(sheet: MonthlySheet) {
    setActionError('')
    setPayingSheet(null)

    try {
      await markSheetPaid(sheet.id)
    } catch (error) {
      setActionError(
        getErrorMessage(
          error,
          `Could not mark ${getCrewName(sheet.crewId)} as paid.`,
        ),
      )
    }
  }

  async function handlePrint(sheet: MonthlySheet) {
    setActionError('')

    try {
      await printReport(sheet)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Could not build the PDF report.'))
    }
  }

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader className="flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardEyebrow>Payouts</CardEyebrow>
            <CardTitle className="mt-2">
              {formatMonthLabel(period.year, period.month)}
            </CardTitle>
          </div>

          <MonthPicker value={period} onChange={setPeriod} />
        </CardHeader>

        {actionError && (
          <p className="mt-4 text-sm font-medium text-red-500">{actionError}</p>
        )}
      </Card>

      <Card>
        {isLoading ? (
          <p className="py-10 text-center text-slate-400">Loading…</p>
        ) : sheetsInPeriod.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Wallet className="size-8 text-sky-300" />
            <p className="text-slate-500">
              No generated sheets for this period yet.
            </p>
          </div>
        ) : (
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>Crew</TableHead>
                <TableHead>Paid to</TableHead>
                <TableHead className="text-center">Days</TableHead>
                <TableHead className="text-right">Driven km</TableHead>
                <TableHead className="text-right">Extra business km</TableHead>
                <TableHead className="text-right">Amount payable</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheetsInPeriod.map((sheet) => (
                <TableRow key={sheet.id}>
                  <TableCell className="font-medium text-slate-900">
                    {getCrewName(sheet.crewId)}
                  </TableCell>
                  <TableCell>{sheet.recipientFullname}</TableCell>
                  <TableCell className="text-center">
                    {sheet.days.length}
                  </TableCell>
                  <TableCell className="text-right">
                    {sheet.totalDrivenKm > 0 ? (
                      formatKm(sheet.totalDrivenKm)
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {sheet.totalExtraBusinessKm > 0 ? (
                      formatKm(sheet.totalExtraBusinessKm)
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-slate-900">
                    {formatCurrency(sheet.totalPayable)}
                  </TableCell>

                  {/* Where the sheet stands, and what can still be done to it, are two
                      different things: the status only ever reports Draft, Confirmed or
                      Paid, and settling it lives with the other row actions. */}
                  <TableCell className="text-center">
                    <SheetStatusBadge sheet={sheet} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {isPayable(sheet) && can('paySheet') && (
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() => setPayingSheet(sheet)}
                        >
                          <BadgeCheck className="size-3.5" />
                          Mark as paid
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="rounded-full border-sky-100 text-sky-700"
                        title={`Print the ${getCrewName(sheet.crewId)} report as PDF`}
                        onClick={() => handlePrint(sheet)}
                      >
                        <FileText className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold text-slate-900" colSpan={5}>
                  Grand total
                </TableCell>
                <TableCell className="text-right text-base font-semibold text-sky-700">
                  {formatCurrency(grandTotal)}
                </TableCell>
                <TableCell
                  className="text-right text-xs font-normal text-slate-500"
                  colSpan={2}
                >
                  Still to pay:{' '}
                  <span className="font-medium text-slate-700">
                    {formatCurrency(outstandingTotal)}
                  </span>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </Card>

      <PaySheetDialog
        sheet={payingSheet}
        onClose={() => setPayingSheet(null)}
        onConfirm={handlePay}
      />
    </section>
  )
}
