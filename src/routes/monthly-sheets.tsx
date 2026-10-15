import { createFileRoute } from '@tanstack/react-router'
import {
  BadgeCheck,
  CalendarCheck,
  Car,
  CheckCircle2,
  Coins,
  FileText,
  Loader2,
  PiggyBank,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Wallet,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { ConfirmDialog } from '@/components/confirm-dialog'
import type { Period } from '@/components/month-picker'
import { MonthPicker } from '@/components/month-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { StatCard } from '@/components/ui/stat-card'
import { usePermissions } from '@/features/auth/use-permissions'
import { useCrews } from '@/features/crews/crews-context'
import { BusinessTripList } from '@/features/monthly-sheets/business-trip-list'
import { businessTripsOf } from '@/features/monthly-sheets/business-trips'
import { MonthGrid } from '@/features/monthly-sheets/month-grid'
import { buildMonthlyReport } from '@/features/monthly-sheets/monthly-report'
import {
  useMonthlySheetPreview,
  useMonthlySheets,
} from '@/features/monthly-sheets/monthly-sheets-context'
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
  formatKmRate,
  formatMonthLabel,
  formatPeriodRange,
  getMonthYear,
} from '@/lib/format'
import { useDebouncedValue } from '@/lib/use-debounced-value'

export const Route = createFileRoute('/monthly-sheets')({
  component: MonthlySheetsPage,
})

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * The index as text for the box. An unpriced month shows an empty field rather than a
 * "0" the accountant has to clear before typing.
 */
function rateAsText(kmRate: number | undefined) {
  return kmRate ? String(kmRate) : ''
}

/** What the box currently means, in TJS per kilometre. Anything unreadable is nothing. */
function rateAsNumber(text: string) {
  const parsed = Number(text)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/** A saved opening balance as text for the box; a month settled in arrears is empty. */
function balanceAsText(openingBalance: number | null | undefined) {
  return openingBalance === null || openingBalance === undefined
    ? ''
    : String(openingBalance)
}

/**
 * What the box means in TJS. An empty box is no advance at all, which is not the same as
 * an advance of zero: only an advance makes the days come off a balance.
 */
function balanceAsNumber(text: string) {
  if (text.trim() === '') return null

  const parsed = Number(text)

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function lastDayOfMonth({ year, month }: Period) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

function firstDayOfMonth({ year, month }: Period) {
  return new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10)
}

function MonthlySheetsPage() {
  const { can } = usePermissions()
  const { crews, getCrewName } = useCrews()
  const {
    isLoading,
    getSheet,
    generateSheet,
    confirmSheet,
    unconfirmSheet,
    markSheetPaid,
    deleteSheet,
  } = useMonthlySheets()
  const printReport = useMonthlyReportPrinter()
  const canPriceSheet = can('generateSheet')

  const [period, setPeriod] = useState<Period>(() =>
    getMonthYear(todayIsoDate()),
  )
  const [crewId, setCrewId] = useState<number | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [payingSheet, setPayingSheet] = useState<MonthlySheet | null>(null)

  // The index belongs to one crew's month, so what is typed for August must not leak
  // into September. Keeping the draft next to the month it was typed for lets the box
  // fall back to whatever the saved sheet was priced with the moment the selection
  // moves, without an effect that races the query.
  const [rateDraft, setRateDraft] = useState<{
    periodKey: string
    text: string
  } | null>(null)

  // The advance handed to the lead belongs to one crew's month just like the index.
  const [balanceDraft, setBalanceDraft] = useState<{
    periodKey: string
    text: string
  } | null>(null)

  // The day the accountant is closing on. Like the index, it belongs to one crew's month,
  // so what is typed for August must not follow the selection into September.
  const [closingDraft, setClosingDraft] = useState<{
    periodKey: string
    date: string
  } | null>(null)

  const activeCrewId = crews.some((crew) => crew.id === crewId)
    ? crewId
    : (crews[0]?.id ?? null)
  const crew = crews.find((candidate) => candidate.id === activeCrewId)
  const sheet = crew
    ? getSheet({ crewId: crew.id, year: period.year, month: period.month })
    : undefined

  const periodKey = `${activeCrewId}-${period.year}-${period.month}`
  const kmRateText =
    rateDraft?.periodKey === periodKey
      ? rateDraft.text
      : rateAsText(sheet?.kmRate)
  const kmRate = rateAsNumber(kmRateText)

  // Typing reprices the month server-side, so the request waits for the accountant to
  // stop rather than firing on every digit.
  const previewKmRate = useDebouncedValue(kmRate)

  const openingBalanceText =
    balanceDraft?.periodKey === periodKey
      ? balanceDraft.text
      : balanceAsText(sheet?.openingBalance)
  const openingBalance = balanceAsNumber(openingBalanceText)
  const previewOpeningBalance = useDebouncedValue(openingBalance)

  // A saved sheet already knows what it closed on; an unsaved one defaults to the whole
  // month, which is what the accountant means unless they say otherwise.
  const closingDate =
    closingDraft?.periodKey === periodKey
      ? closingDraft.date
      : (sheet?.periodEnd ?? lastDayOfMonth(period))

  const previewClosingDate = useDebouncedValue(closingDate)

  // A month without a saved sheet is still worth reading, so what generating would
  // produce is loaded straight away rather than hidden behind a button. A saved sheet
  // always wins: once the month exists, that is the record and there is nothing to
  // preview.
  const preview = useMonthlySheetPreview(
    crew && !sheet && canPriceSheet
      ? {
          crewId: crew.id,
          year: period.year,
          month: period.month,
          kmRate: previewKmRate,
          openingBalance: previewOpeningBalance,
          periodEnd: previewClosingDate,
        }
      : null,
  )

  const displayedSheet = sheet ?? preview.data ?? null

  const report = useMemo(
    () =>
      displayedSheet
        ? buildMonthlyReport(displayedSheet, getCrewName(displayedSheet.crewId))
        : null,
    [displayedSheet, getCrewName],
  )

  const businessTrips = displayedSheet
    ? businessTripsOf(displayedSheet.days)
    : []

  // Generating a month the crew neither drove nor paid for is refused server-side, so
  // the button only appears once there is something to save.
  const hasSomethingToSave = (displayedSheet?.days.length ?? 0) > 0

  // A draft follows the transport log on its own, but it keeps the index, balance and
  // closing date it was saved with until it is saved again, so a typed value that has
  // not been applied yet has to say so out loud — otherwise the totals below silently
  // disagree with the box above them.
  const hasUnappliedRate =
    sheet !== undefined &&
    !sheet.isConfirmed &&
    !displayedSheet?.isPricedByTariff &&
    kmRate !== sheet.kmRate

  const hasUnappliedBalance =
    sheet !== undefined &&
    !sheet.isConfirmed &&
    openingBalance !== sheet.openingBalance

  const hasUnappliedClosingDate =
    sheet !== undefined && !sheet.isConfirmed && closingDate !== sheet.periodEnd

  const unappliedInputs = [
    hasUnappliedRate && 'index',
    hasUnappliedBalance && 'opening balance',
    hasUnappliedClosingDate && 'closing date',
  ].filter(Boolean)

  const needsSaving = sheet === undefined || unappliedInputs.length > 0

  const isPricingLocked = !canPriceSheet || (sheet?.isConfirmed ?? false)

  function selectCrew(nextCrewId: number) {
    setCrewId(nextCrewId)
    setActionError('')
  }

  function editRate(text: string) {
    setRateDraft({ periodKey, text })
    setActionError('')
  }

  function editBalance(text: string) {
    setBalanceDraft({ periodKey, text })
    setActionError('')
  }

  function editClosingDate(date: string) {
    setClosingDraft({ periodKey, date })
    setActionError('')
  }

  function selectPeriod(nextPeriod: Period) {
    setPeriod(nextPeriod)
    setActionError('')
  }

  // Every action fails the same way — into one message under the header — so each one
  // is just its own call plus a sentence to show if the backend refuses it.
  async function run(action: () => Promise<unknown>, fallbackMessage: string) {
    setIsBusy(true)
    setActionError('')

    try {
      await action()
    } catch (error) {
      setActionError(getErrorMessage(error, fallbackMessage))
    } finally {
      setIsBusy(false)
    }
  }

  const handleGenerate = () =>
    run(async () => {
      if (!crew) return

      await generateSheet({
        crewId: crew.id,
        year: period.year,
        month: period.month,
        kmRate,
        openingBalance,
        periodEnd: closingDate,
      })
    }, 'Could not generate the sheet.')

  const handleConfirm = () =>
    run(async () => {
      if (sheet) await confirmSheet(sheet.id)
    }, 'Could not confirm the sheet.')

  const handleUnconfirm = () =>
    run(async () => {
      if (sheet) await unconfirmSheet(sheet.id)
    }, 'Could not reopen the sheet.')

  const handlePay = (paidSheet: MonthlySheet) =>
    run(() => markSheetPaid(paidSheet.id), 'Could not mark this crew as paid.')

  const handleDelete = () =>
    run(async () => {
      if (sheet) await deleteSheet(sheet.id)
    }, 'Could not delete the sheet.')

  const handlePrint = () =>
    run(async () => {
      if (displayedSheet) await printReport(displayedSheet)
    }, 'Could not build the PDF report.')

  const errorMessage =
    actionError ||
    (preview.error
      ? getErrorMessage(
          preview.error,
          'Could not compute this period for the crew.',
        )
      : '')

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader className="flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>
              {formatMonthLabel(period.year, period.month)}
            </CardTitle>
          </div>

          <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
            <Select
              value={activeCrewId ?? ''}
              onChange={(event) => selectCrew(Number(event.target.value))}
              className="w-full sm:w-56"
            >
              {crews.length === 0 && <option value="">No crews yet</option>}
              {crews.map((crewOption) => (
                <option key={crewOption.id} value={crewOption.id}>
                  {crewOption.name}
                </option>
              ))}
            </Select>
            <MonthPicker value={period} onChange={selectPeriod} />

            {/* The index is a property of the crew's month, not a global setting: it is
                entered here, saved with the sheet, and stays readable on it afterwards. */}
            <div className="w-[calc(50%-0.375rem)] sm:w-44">
              <label
                className="text-sm font-medium text-soft-foreground"
                htmlFor="km-rate"
              >
                Index (TJS/km)
              </label>
              <Input
                id="km-rate"
                className="mt-1.5 disabled:cursor-not-allowed disabled:opacity-60"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={kmRateText}
                disabled={isPricingLocked}
                onChange={(event) => editRate(event.target.value)}
              />
            </div>
            {/* Some leads are handed the month's money up front. Leaving this empty
                settles the month in arrears, as before. */}
            <div className="w-[calc(50%-0.375rem)] sm:w-44">
              <label
                className="text-sm font-medium text-soft-foreground"
                htmlFor="opening-balance"
              >
                Opening balance (TJS)
              </label>
              <Input
                id="opening-balance"
                className="mt-1.5 disabled:cursor-not-allowed disabled:opacity-60"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="Paid at month end"
                value={openingBalanceText}
                disabled={isPricingLocked}
                onChange={(event) => editBalance(event.target.value)}
              />
            </div>
            {/* Paying before the month is out settles only up to this day; the rest of
                the month goes to the next sheet instead of being closed with this one. */}
            <div className="w-[calc(50%-0.375rem)] sm:w-44">
              <label
                className="text-sm font-medium text-soft-foreground"
                htmlFor="closing-date"
              >
                Close on
              </label>
              <Input
                id="closing-date"
                className="mt-1.5 disabled:cursor-not-allowed disabled:opacity-60"
                type="date"
                min={firstDayOfMonth(period)}
                max={lastDayOfMonth(period)}
                value={closingDate}
                disabled={isPricingLocked}
                onChange={(event) => editClosingDate(event.target.value)}
              />
            </div>
          </div>
        </CardHeader>

        {!isPricingLocked && unappliedInputs.length > 0 && (
          <p className="mt-4 text-sm font-medium text-warning">
            {`The ${unappliedInputs.join(' and ')} ${unappliedInputs.length > 1 ? 'have' : 'has'} not been applied yet — save the sheet to use ${unappliedInputs.length > 1 ? 'them' : 'it'}.`}
          </p>
        )}
      </Card>

      {!crew ? (
        <Card>
          <p className="py-10 text-center text-faint-foreground">No crews yet.</p>
        </Card>
      ) : isLoading || preview.isLoading ? (
        <Card>
          <p className="flex items-center justify-center gap-2 py-10 text-faint-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardEyebrow>{crew.name}</CardEyebrow>
              <CardTitle className="mt-2 flex flex-wrap items-center gap-3">
                {sheet ? (
                  <>
                    Generated Sheet
                    <SheetStatusBadge sheet={sheet} />
                  </>
                ) : displayedSheet ? (
                  <>
                    Not generated yet
                    <Badge variant="secondary">Unsaved</Badge>
                  </>
                ) : (
                  'No sheet yet'
                )}
              </CardTitle>
              {displayedSheet && (
                <CardDescription className="mt-2">
                  Paid to{' '}
                  <span className="font-medium text-soft-foreground">
                    {displayedSheet.recipientFullname || 'the crew lead'}
                  </span>
                  {' · '}
                  <span className="font-medium text-soft-foreground">
                    {formatPeriodRange(
                      displayedSheet.periodStart,
                      displayedSheet.periodEnd,
                    )}
                  </span>
                </CardDescription>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {/* A draft picks up newly logged days by itself, so a saved one only
                  needs saving again when the accountant changed what they typed. */}
              {needsSaving && hasSomethingToSave && can('generateSheet') && (
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full"
                  disabled={isBusy}
                  onClick={handleGenerate}
                >
                  {sheet ? (
                    <Save className="size-3.5" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {sheet ? 'Save' : 'Generate & Save'}
                </Button>
              )}

              {sheet && !sheet.isConfirmed && can('confirmSheet') && (
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full bg-success text-success-foreground hover:bg-success/90"
                  disabled={isBusy}
                  onClick={handleConfirm}
                >
                  <CheckCircle2 className="size-3.5" />
                  Confirm sheet
                </Button>
              )}

              {/* Confirming only freezes the figures, so it can be taken back while the
                  month is still unpaid — the sheet returns to draft and follows the
                  transport log again. Paying is what closes it for good. */}
              {sheet &&
                !sheet.isPaid &&
                sheet.isConfirmed &&
                can('confirmSheet') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full border-border text-accent-foreground"
                    disabled={isBusy}
                    onClick={handleUnconfirm}
                  >
                    <Undo2 className="size-3.5" />
                    Go back
                  </Button>
                )}

              {sheet && isPayable(sheet) && can('paySheet') && (
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full bg-success text-success-foreground hover:bg-success/90"
                  disabled={isBusy}
                  onClick={() => setPayingSheet(sheet)}
                >
                  <BadgeCheck className="size-3.5" />
                  Mark as paid
                </Button>
              )}

              {displayedSheet && can('printSheet') && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-border text-accent-foreground"
                  disabled={isBusy}
                  onClick={handlePrint}
                >
                  <FileText className="size-3.5" />
                  Print PDF
                </Button>
              )}

              {sheet && !sheet.isConfirmed && can('deleteSheet') && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="rounded-full"
                  disabled={isBusy}
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              )}
            </div>
          </CardHeader>

          {errorMessage && (
            <p className="mt-4 text-sm font-medium text-destructive">
              {errorMessage}
            </p>
          )}

          {!report ? (
            <p className="py-10 text-center text-faint-foreground">
              Nothing to show for this period yet.
            </p>
          ) : (
            <div className="mt-5 space-y-6">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 sm:gap-4">
                <StatCard
                  label="Days travelled"
                  value={report.travelledDayCount}
                  icon={CalendarCheck}
                />
                {/* A lead paid in advance sees first what is left of it; the legs and
                    kilometres stay readable in the pricing card's hint. Otherwise the
                    crew is shown in the unit it is paid in and no other: a tariffed
                    crew's kilometres price nothing, and showing them alongside the money
                    only invites them to be added together. */}
                {report.openingBalance !== null && report.balance !== null ? (
                  <StatCard
                    label="Balance"
                    value={formatCurrency(report.balance)}
                    icon={PiggyBank}
                    hint={
                      report.balance < 0
                        ? `Overspent ${formatCurrency(-report.balance)} of ${formatCurrency(report.openingBalance)}`
                        : `Left of ${formatCurrency(report.openingBalance)}`
                    }
                  />
                ) : report.isPricedByTariff ? (
                  <StatCard
                    label="Legs driven"
                    value={report.totalDrivenLegs}
                    icon={RefreshCw}
                  />
                ) : (
                  <StatCard
                    label="Driven (round trip)"
                    value={formatKm(report.totalDrivenKm)}
                    icon={RefreshCw}
                    hint={
                      report.totalExtraBusinessKm > 0
                        ? `+ ${formatKm(report.totalExtraBusinessKm)} business`
                        : undefined
                    }
                  />
                )}
                {report.isPricedByTariff ? (
                  <>
                    <StatCard
                      label="Trips priced"
                      value={formatCurrency(report.totalTariffAmount)}
                      icon={Coins}
                      hint={`${report.totalDrivenLegs} legs at ${formatCurrency(report.tariffPerLeg)}`}
                    />
                    {/* The tariff buys the commute; driving elsewhere for the company
                        is still distance and is still paid for. */}
                    {report.totalExtraBusinessKm > 0 && (
                      <StatCard
                        label="Business travel"
                        value={formatCurrency(report.totalKmAmount)}
                        icon={Coins}
                        hint={`${formatKm(report.totalExtraBusinessKm)} at ${formatKmRate(report.kmRate)}`}
                      />
                    )}
                  </>
                ) : (
                  <StatCard
                    label="Distance priced"
                    value={formatCurrency(report.totalKmAmount)}
                    icon={Coins}
                    hint={`${formatKm(report.totalPricedKm)} at ${formatKmRate(report.kmRate)}`}
                  />
                )}
                <StatCard
                  label="Taxi to reimburse"
                  value={formatCurrency(report.totalTaxiAmount)}
                  icon={Wallet}
                />
                {/* Only a driver-lead drives the crew in their own car, so the card
                    appears only where there is a car to be paid for. */}
                {report.amortizationAmount > 0 && (
                  <StatCard
                    label="Car allowance"
                    value={formatCurrency(report.amortizationAmount)}
                    icon={Car}
                  />
                )}
                <StatCard
                  label="Total payable"
                  value={formatCurrency(report.totalPayable)}
                  icon={BadgeCheck}
                  hint={
                    report.openingBalance !== null
                      ? 'Overspend and car allowance'
                      : undefined
                  }
                />
              </div>

              {report.travelledDayCount === 0 ? (
                <p className="py-10 text-center text-faint-foreground">
                  No travel logged for this crew in this period.
                </p>
              ) : (
                <>
                  <MonthGrid report={report} />
                  {businessTrips.length > 0 && (
                    <BusinessTripList trips={businessTrips} />
                  )}
                </>
              )}
            </div>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this monthly sheet?"
        description="This action cannot be undone. It can be generated again from the confirmed transport days."
        onConfirm={handleDelete}
      />

      <PaySheetDialog
        sheet={payingSheet}
        onClose={() => setPayingSheet(null)}
        onConfirm={handlePay}
      />
    </section>
  )
}
