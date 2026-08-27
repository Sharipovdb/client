import { createFileRoute, Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Bus,
  CalendarCheck,
  CircleDollarSign,
  Receipt,
  Users,
  Wallet,
} from 'lucide-react'
import { useMemo } from 'react'

import {
  Card,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePermissions } from '@/features/auth/use-permissions'
import { useCrewMemberships } from '@/features/crews/crew-memberships-context'
import { useCrews } from '@/features/crews/crews-context'
import { useEmployees } from '@/features/employees/employees-context'
import { useMonthlySheets } from '@/features/monthly-sheets/monthly-sheets-context'
import { useTaxiExpenses } from '@/features/taxi-expenses/taxi-expenses-context'
import { useTransportDays } from '@/features/transport-days/transport-days-context'
import { isSameId } from '@/lib/domain-types'
import { formatCurrency, formatMonthLabel, getMonthYear } from '@/lib/format'
import { appPagePaths } from '@/lib/permissions'

export const Route = createFileRoute('/')({ component: DashboardPage })

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function DashboardPage() {
  const { can, canOpen } = usePermissions()
  const { employees } = useEmployees()
  const { crews } = useCrews()
  const { getActiveMembersForCrew } = useCrewMemberships()
  const { transportDays, getDaysForCrewMonth } = useTransportDays()
  const { taxiExpenses } = useTaxiExpenses()
  const { sheets } = useMonthlySheets()

  const showFinance = can('viewFinance')

  const period = useMemo(
    () =>
      transportDays.length === 0
        ? getMonthYear(todayIsoDate())
        : getMonthYear(
            transportDays.reduce((latest, day) =>
              day.date > latest.date ? day : latest,
            ).date,
          ),
    [transportDays],
  )

  const dayIdsInPeriod = useMemo(
    () =>
      new Set(
        transportDays
          .filter((day) => {
            const dayPeriod = getMonthYear(day.date)
            return (
              dayPeriod.year === period.year && dayPeriod.month === period.month
            )
          })
          .map((day) => day.id),
      ),
    [transportDays, period],
  )

  // Money the company owes but has not released: approved fares only. A pending fare
  // has not been ruled on and a rejected one never will be, so neither is owed.
  const owedTaxiThisPeriod = useMemo(
    () =>
      taxiExpenses
        .filter(
          (expense) =>
            dayIdsInPeriod.has(expense.transportDayId) &&
            expense.taxiExpenseStatus === 'Approved',
        )
        .reduce((total, expense) => total + expense.amount, 0),
    [taxiExpenses, dayIdsInPeriod],
  )

  const pendingApprovalCount = useMemo(
    () =>
      taxiExpenses.filter(
        (expense) =>
          dayIdsInPeriod.has(expense.transportDayId) &&
          expense.taxiExpenseStatus === 'Pending',
      ).length,
    [taxiExpenses, dayIdsInPeriod],
  )

  const crewData = useMemo(
    () =>
      crews.map((crew) => {
        const days = getDaysForCrewMonth(
          crew.id,
          period.year,
          period.month,
        )
        // Counted in days, not legs — a day is the unit the report and the accountant
        // work in. A day that drove one way and taxied the other counts in both.
        const drivenDays = days.filter(
          (day) => day.morningMode === 'Driven' || day.afternoonMode === 'Driven',
        ).length
        const taxiDays = days.filter(
          (day) => day.morningMode === 'Taxi' || day.afternoonMode === 'Taxi',
        ).length

        return {
          crew,
          daysLogged: days.length,
          drivenDays,
          taxiDays,
          members: getActiveMembersForCrew(crew.id),
          sheet: sheets.find(
            (candidate) =>
              isSameId(candidate.crewId, crew.id) &&
              candidate.year === period.year &&
              candidate.month === period.month,
          ),
        }
      }),
    [crews, period, getDaysForCrewMonth, getActiveMembersForCrew, sheets],
  )

  const totalPayout = crewData.reduce(
    (total, row) => total + (row.sheet?.totalPayable ?? 0),
    0,
  )
  const draftSheets = crewData.filter(
    (row) => row.sheet && !row.sheet.isConfirmed,
  )
  const ungeneratedSheets = crewData.filter(
    (row) => !row.sheet && row.daysLogged > 0,
  )
  const overflowCrews = crewData.filter(
    (row) => row.members.length > row.crew.seatCapacity,
  )
  const driverCount = employees.filter((employee) =>
    employee.roles.includes('DriverLead'),
  ).length

  const stats = [
    { label: 'Employees', value: employees.length, icon: Users },
    {
      label: 'Crews',
      value: crews.length,
      icon: Bus,
      hint: `${driverCount} drivers`,
    },
    { label: 'Days logged', value: dayIdsInPeriod.size, icon: CalendarCheck },
    {
      label: 'Sheets to confirm',
      value: draftSheets.length,
      icon: AlertTriangle,
    },
    ...(showFinance
      ? [
          {
            label: 'Taxi approved, unpaid',
            value: formatCurrency(owedTaxiThisPeriod),
            icon: Receipt,
          },
          {
            label: 'Payout (month)',
            value: formatCurrency(totalPayout),
            icon: Wallet,
          },
        ]
      : []),
  ]

  const pendingActions = buildPendingActions({
    canOpenSheets: canOpen(appPagePaths.monthlySheets),
    canOpenTaxiExpenses:
      canOpen(appPagePaths.taxiExpenses) && can('approveTaxiExpense'),
    canOpenCrews: canOpen(appPagePaths.crews),
    canGenerate: can('generateSheet'),
    draftCount: draftSheets.length,
    ungeneratedCount: ungeneratedSheets.length,
    overflowCount: overflowCrews.length,
    pendingApprovalCount,
  })

  const crewColumnCount = showFinance ? 5 : 4

  return (
    <section className="space-y-6">
      <p className="text-sm text-slate-500">
        Overview for {formatMonthLabel(period.year, period.month)}
      </p>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 sm:gap-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            hint={stat.hint}
          />
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="border-b border-sky-100 pb-5">
            <CardEyebrow>Crews</CardEyebrow>
            <CardTitle className="mt-2">This month by crew</CardTitle>
            <CardDescription className="mt-2">
              Seats and logged days per crew
              {showFinance ? ', with the money a generated sheet owes its lead' : ''}.
            </CardDescription>
          </CardHeader>

          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Crew</TableHead>
                  <TableHead className="text-center">Seats</TableHead>
                  <TableHead className="text-center">Days</TableHead>
                  <TableHead className="text-center">Driven / Taxi days</TableHead>
                  {showFinance && (
                    <TableHead className="text-right">Payout</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {crewData.map(
                  ({
                    crew,
                    daysLogged,
                    drivenDays,
                    taxiDays,
                    members,
                    sheet,
                  }) => {
                    const overflow = members.length > crew.seatCapacity

                    return (
                      <TableRow key={crew.id}>
                        <TableCell className="font-medium text-slate-900">
                          {crew.name}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={
                              overflow
                                ? 'font-semibold text-amber-600'
                                : undefined
                            }
                          >
                            {members.length} / {crew.seatCapacity}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {daysLogged}
                        </TableCell>
                        <TableCell className="text-center">
                          {drivenDays} / {taxiDays}
                        </TableCell>
                        {showFinance && (
                          <TableCell className="text-right">
                            {sheet ? formatCurrency(sheet.totalPayable) : '—'}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  },
                )}

                {crewData.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={crewColumnCount}
                      className="py-10 text-center text-slate-400"
                    >
                      No crews yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardEyebrow>Needs attention</CardEyebrow>
            <CardTitle className="mt-2">Pending actions</CardTitle>
          </CardHeader>

          <div className="mt-5 space-y-3">
            {pendingActions.map((action) => (
              <Link
                key={action.text}
                to={action.to}
                className="flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50/40 px-4 py-3 transition hover:border-sky-200 hover:bg-sky-50"
              >
                <action.icon
                  className={`mt-0.5 size-4 shrink-0 ${toneClasses[action.tone]}`}
                />
                <span className="text-sm text-slate-700">{action.text}</span>
              </Link>
            ))}

            {pendingActions.length === 0 && (
              <p className="rounded-2xl border border-dashed border-sky-200 px-4 py-8 text-center text-sm text-slate-400">
                All caught up — nothing needs attention.
              </p>
            )}
          </div>
        </Card>
      </div>
    </section>
  )
}

type ActionTone = 'default' | 'warning' | 'destructive'

const toneClasses: Record<ActionTone, string> = {
  default: 'text-sky-600',
  warning: 'text-amber-600',
  destructive: 'text-red-600',
}

interface PendingAction {
  to: string
  icon: LucideIcon
  tone: ActionTone
  text: string
}

interface PendingActionInput {
  canOpenSheets: boolean
  canOpenTaxiExpenses: boolean
  canOpenCrews: boolean
  canGenerate: boolean
  draftCount: number
  ungeneratedCount: number
  overflowCount: number
  pendingApprovalCount: number
}

// Only surfaces work the signed-in role can actually act on, so nobody is pointed at
// a page they cannot open.
function buildPendingActions(input: PendingActionInput): PendingAction[] {
  const actions: PendingAction[] = []

  if (input.canOpenSheets && input.draftCount > 0) {
    actions.push({
      to: appPagePaths.monthlySheets,
      icon: CalendarCheck,
      tone: 'warning',
      text: `${input.draftCount} sheet(s) awaiting confirmation`,
    })
  }

  if (input.canOpenSheets && input.canGenerate && input.ungeneratedCount > 0) {
    actions.push({
      to: appPagePaths.monthlySheets,
      icon: CalendarCheck,
      tone: 'default',
      text: `${input.ungeneratedCount} crew(s) with logged days but no sheet generated`,
    })
  }

  if (input.canOpenTaxiExpenses && input.pendingApprovalCount > 0) {
    actions.push({
      to: appPagePaths.taxiExpenses,
      icon: CircleDollarSign,
      tone: 'warning',
      text: `${input.pendingApprovalCount} taxi expense(s) awaiting approval`,
    })
  }

  if (input.canOpenCrews && input.overflowCount > 0) {
    actions.push({
      to: appPagePaths.crews,
      icon: AlertTriangle,
      tone: 'destructive',
      text: `${input.overflowCount} crew(s) over seat capacity`,
    })
  }

  return actions
}
