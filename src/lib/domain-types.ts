// Domain types mirroring the backend business entities (Transportation.Domain.Entities).
// Ids are kept as strings (stringified backend `long` ids) at this layer so existing
// UI bindings (<select value>, equality checks) stay simple — each context converts
// to/from the backend's numeric ids at the API boundary.

import type { AppRole } from './app-types'

/**
 * Backend ids are `long`. Some contexts keep them as numbers (Employee, Crew, Vehicle,
 * TransportRoute, CrewMembership) while the operational ones stringify them
 * (TransportDay, TaxiExpense, MonthlySheet). A plain `===` across that
 * boundary compares 1 to "1" and is silently always false, which is what used to turn
 * every crew into "Unknown crew". Cross-entity lookups must go through this helper.
 */
export function isSameId(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
) {
  if (left === null || left === undefined) return false
  if (right === null || right === undefined) return false

  return String(left) === String(right)
}

export type EntityId = string | number

export const employeeRolesAdd = [
  'Admin',
  'RouteManager',
  'Worker',
  'Accountant',
] as const

export const employeeRoles = [
  'Admin',
  'RouteManager',
  'CrewLead',
  'DriverLead',
  'Worker',
  'Accountant',
] as const

export type EmployeeRole = (typeof employeeRoles)[number]

export const employeeRoleLabels: Record<EmployeeRole, string> = {
  Admin: 'Admin',
  RouteManager: 'Route Manager',
  CrewLead: 'Crew Lead',
  DriverLead: 'Driver Lead',
  Worker: 'Worker',
  Accountant: 'Accountant',
}

// The backend's `Admin` role is a technical access level (see lib/app-types.ts），not
// one of the PRD's business roles, so it's deliberately excluded here — an Admin
// account never shows up as an "Employee".
export interface Employee {
  id: number
  email: string | null
  userName: string
  fullname: string
  phoneNumber: string
  telegramId: string | null
  roles: AppRole[]
}

// export function getEmployeeName(
//   employee: Pick<Employee, 'firstName' | 'lastName'>,
// ) {
//   return `${employee.firstName} ${employee.lastName}`.trim()
// }

export interface TransportRoute {
  id: number
  name: string
  distanceKm: number
}

export interface Vehicle {
  id: number
  driverId: number
  plate: string
  seatCount: number
  amortizationBasis: number
}

/**
 * A named price for one driven leg — the company's alternative to paying by the kilometre.
 *
 * A tariff is a catalogue entry, not a property of one crew: several crews can be put on
 * the same price, and a crew is placed on one by choosing it when it is set up.
 */
export interface Tariff {
  id: number
  name: string
  amountPerLeg: number
}

// A crew lead is either a Driver-Lead (drives their own car) or a Manager-Lead
// (arranges and pays for taxis). The backend models this as two separate nullable
// foreign keys on Crew (driverLeadId / crewLeadId); the frontend simplifies this to a
// single leadId + leadType pair for form handling — translated back to the two FKs at
// the API boundary in features/crews/crews-context.tsx.

export interface Crew {
  id: number
  name: string
  // A crew is measured along a route or paid at a tariff — exactly one of these is set.
  // No route means its commute is priced per leg instead of per kilometre.
  routeId: number | null
  tariffId: number | null
  driverLeadId: number | null
  crewLeadId: number | null
  seatCapacity: number
}

export function isCrewLedBy(crew: Crew, userId: number | undefined) {
  return (
    userId !== undefined &&
    (crew.driverLeadId === userId || crew.crewLeadId === userId)
  )
}

export interface CrewMembership {
  id: number
  crewId: number
  employeeId: number
  activeFrom: string
  activeTo: string | null
  isActive: boolean
}

// --- Daily operations (mirrors Transportation.Domain.Entities.TransportDay) ---

// How a crew travelled on a single leg (morning / afternoon) of a working day.
export const transportModes = ['Driven', 'Taxi', 'None'] as const
export type TransportMode = (typeof transportModes)[number]

export const transportModeLabels: Record<TransportMode, string> = {
  Driven: 'Driven',
  Taxi: 'Taxi',
  None: 'None',
}

// A working day for one crew. Splitting the mode into two legs is what makes the
// "drove in the morning, taxied home" case representable without a hack. The driver
// and the route distance are derived server-side from the crew — not set here.
//
// A logged day needs no further sign-off: its kilometres and taxi fares flow straight
// to Monthly Sheets and Payouts.
export interface TransportDay {
  id: number
  crewId: number
  date: string // ISO yyyy-mm-dd
  morningMode: TransportMode
  afternoonMode: TransportMode | null
  driverId: number | null
  // Length of one leg (crew route + any detour) versus what was actually driven:
  // a taxi leg costs money and covers no distance, so it adds nothing to drivenKm.
  commuteKmPerLeg: number
  drivenKm: number
  extraBusinessKm: number // km driven for company purposes beyond the commute
  notes: string | null
  loggedBy: number
  loggedAt: string
  // Every taxi leg carries its fare — recorded here, in the daily log, so a ride can
  // never end up without a reimbursable expense behind it.
  taxiFares: TaxiFare[]
}

// What the person logging the day knows about a taxi leg: what it cost and who paid.
export interface TaxiFareDraft {
  leg: Leg
  amount: number
  paidById: number
}

// The same fare once it exists server-side. Once it is paid, its day is closed.
export interface TaxiFare extends TaxiFareDraft {
  id: number
  status: TaxiExpenseStatus
}

export function isDayOpen(day: TransportDay) {
  return day.taxiFares.every((fare) => fare.status !== 'Paid')
}

// --- Taxi expenses (mirrors Transportation.Domain.Entities.TaxiExpense) ---

export const legs = ['Morning', 'Afternoon'] as const
export type Leg = (typeof legs)[number]

export const legLabels: Record<Leg, string> = {
  Morning: 'Morning',
  Afternoon: 'Afternoon',
}

// Mirrors the backend's TaxiExpenseStatus: a fare is Pending until the sheet that
// carries it is paid.
export const taxiExpenseStatuses = ['Pending', 'Paid'] as const
export type TaxiExpenseStatus = (typeof taxiExpenseStatuses)[number]

export interface TaxiExpense {
  id: number
  transportDayId: number
  paidById: number
  leg: Leg
  amount: number
  taxiExpenseStatus: TaxiExpenseStatus
}

// --- Monthly sheet (mirrors Transportation.Domain.Entities.MonthlyTransportSheet) ---
//
// A crew's month is settled as a whole with its lead, who distributes the money inside
// the team — so there is one recipient, not a line per member. Everything below is
// computed server-side and read-only here: the figures on every screen and in the
// printed report come from this one payload, never from a second calculation.

/** One working day of the crew: distance covered in its own car, or what a taxi cost. */
export interface MonthlySheetDay {
  transportDayId: number
  date: string // ISO yyyy-mm-dd
  drivenLegCount: number // 0, 1 or 2 — what a tariff is charged per
  drivenKm: number // round trip when both legs were driven
  extraBusinessKm: number
  taxiAmount: number
}

// `id` is 0 for an unsaved preview (POST /GetPreview computes but doesn't persist).
export interface MonthlySheet {
  id: number
  crewId: number
  year: number
  month: number // 1-12
  // The stretch of days actually settled. Normally the whole month, but a month closed
  // early ends on the closing date and hands the rest to the next sheet — whose period
  // then starts in the month before it.
  periodStart: string // ISO yyyy-mm-dd
  periodEnd: string // ISO yyyy-mm-dd
  recipientId: number
  recipientFullname: string
  isConfirmed: boolean
  isPaid: boolean
  paidAt: string | null
  days: MonthlySheetDay[]
  // TJS per kilometre — the accountant's index, entered on the Monthly Sheets page and
  // saved with the sheet, so what was paid stays readable afterwards.
  kmRate: number
  // The month's allowance for the lead's own car, frozen from the vehicle's
  // amortization basis when the sheet was built. 0 for a manager-led crew.
  amortizationAmount: number
  // The flat per-leg price this month was settled at, frozen the same way. 0 means the
  // crew was priced by distance instead — the two are alternatives, never a mix, so
  // exactly one of `totalKmAmount` and `totalTariffAmount` is ever non-zero.
  tariffPerLeg: number
  isPricedByTariff: boolean
  // Distance and money are still totalled apart, because that is how the report reads,
  // but everything below ends up in TJS and `totalPayable` is the single amount handed
  // to the lead. Computed server-side: never recompute these on the client.
  totalDrivenKm: number
  totalExtraBusinessKm: number
  totalTaxiAmount: number
  totalPricedKm: number
  totalDrivenLegs: number
  totalKmAmount: number
  totalTariffAmount: number
  // What the crew's own driving is worth, whichever way it was priced.
  totalDrivingAmount: number
  totalPayable: number
}
