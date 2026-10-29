// Single source of truth for access control.
//
// Page access is declared once here and consumed by BOTH the sidebar and the route
// guard, so a role can never see a link it is not allowed to open. Capabilities cover
// the finer-grained rights *inside* a page that several roles share.

import type { AppRole } from './app-types'

export const appPagePaths = {
  dashboard: '/',
  employees: '/employees',
  crews: '/crews',
  transportDays: '/transport-days',
  routes: '/routes',
  vehicles: '/vehicles',
  taxiExpenses: '/taxi-expenses',
  payouts: '/payouts',
  monthlySheets: '/monthly-sheets',
  tariffs: '/tariffs',
} as const

const {
  dashboard,
  employees,
  crews,
  transportDays,
  routes,
  vehicles,
  taxiExpenses,
  payouts,
  monthlySheets,
  tariffs,
} = appPagePaths

// Derived from the roles in the spec:
// - Route Manager assigns people to crews and routes; no financial screens.
// - Crew leads (manager or driver) log days and the taxi fares that go with them.
//   Either kind may read the monthly sheets of their crew and enter the advance they
//   were handed; pricing and settling a month stays the accountant's.
// - The accountant "sees all" for reconciliation.
// - A worker only notifies absence, so they get the dashboard until an Absences page exists.
// Employees (login accounts + business profile in one, backed by /api/User) is where
// an Admin manages everyone, including role assignment — there's no separate "Users" page.
const rolePagePaths: Partial<Record<AppRole, ReadonlyArray<string>>> = {
  Admin: [
    dashboard,
    employees,
    crews,
    transportDays,
    routes,
    vehicles,
    taxiExpenses,
    payouts,
    monthlySheets,
    tariffs,
  ],
  RouteManager: [
    dashboard,
    employees,
    crews,
    transportDays,
    routes,
    vehicles,
    taxiExpenses,
  ],
  CrewLead: [dashboard, transportDays, taxiExpenses, monthlySheets],
  DriverLead: [dashboard, transportDays, taxiExpenses, monthlySheets],
  Accountant: [
    dashboard,
    transportDays,
    routes,
    vehicles,
    taxiExpenses,
    payouts,
    monthlySheets,
    tariffs,
  ],
  Worker: [dashboard],
}

function matchesPath(allowedPath: string, pathname: string) {
  if (allowedPath === dashboard) {
    return pathname === dashboard
  }

  return pathname === allowedPath || pathname.startsWith(`${allowedPath}/`)
}

// `roles` comes from a persisted session, so an unknown role name is possible in
// practice even though the type says otherwise — an unknown role simply grants nothing.
export function canAccessPath(roles: AppRole[], pathname: string) {
  return roles.some((role) =>
    (rolePagePaths[role] ?? []).some((allowedPath) =>
      matchesPath(allowedPath, pathname),
    ),
  )
}

// Rights inside a page that is already visible to several roles.
export type Capability =
  // Money. These stay coarse on purpose: a monthly sheet is settled as a whole, and
  // the backend gates the same actions with RoleAuthorize(Accountant, Admin) on
  // MonthlyTransportSheetsController.
  | 'viewFinance' // payout figures and outstanding money on the dashboard
  | 'generateSheet'
  | 'confirmSheet' // signs the month off, and withdraws that signature while unpaid
  | 'deleteSheet' // drops a draft entirely; a paid sheet is final and neither applies
  | 'paySheet' // release a crew's month to its lead; a lead confirms but never pays
  | 'printSheet'
  // The advance a lead was handed. Unlike the rest of the sheet a lead may enter it
  // themselves, but only on a draft the accountant already generated — the backend's
  // SetOpeningBalance changes nothing else, and confirming still checks it.
  | 'setOpeningBalance'
  // The money the accountant received for the month to pay every crew from, entered on
  // Payouts. The backend gates AccountantBalance/Set with Accountant and Admin.
  | 'setAccountantBalance'

  // Messages behind the bell. Everyone reads them; writing one is the accountant's and
  // the admin's, as on the backend's Messages/Create.
  | 'sendMessage'

  // Transport days. A logged day needs no sign-off — its kilometres are known from the
  // crew's route — so there is nothing to confirm here.
  | 'createTransportDay'
  | 'updateTransportDay'
  | 'deleteTransportDay'

  // Taxi expenses. Rides are created and removed through the transport day; this screen
  // only corrects a fare.
  | 'updateTaxiExpense'

  // Routes
  | 'createRoute'
  | 'updateRoute'
  | 'deleteRoute'

  // Vehicles
  | 'createVehicle'
  | 'updateVehicle'
  | 'deleteVehicle'

  // Tariffs. What a crew's trip is worth is a pricing decision, so it sits with the
  // people who price the month rather than with the leads who log the travel.
  | 'createTariff'
  | 'updateTariff'
  | 'deleteTariff'

  // People. Anyone can change their own password; setting a new one for someone who
  // forgot theirs is the admin's, as on the backend's ResetPassword.
  | 'resetPassword'

const roleCapabilities: Partial<Record<AppRole, ReadonlyArray<Capability>>> = {
  Admin: [
    'createTransportDay',
    'updateTransportDay',
    'deleteTransportDay',

    'updateTaxiExpense',

    'createRoute',
    'updateRoute',
    'deleteRoute',

    'createVehicle',
    'updateVehicle',
    'deleteVehicle',

    'createTariff',
    'updateTariff',
    'deleteTariff',

    'viewFinance',
    'generateSheet',
    'confirmSheet',
    'deleteSheet',
    'paySheet',
    'printSheet',
    'setOpeningBalance',
    'setAccountantBalance',

    'sendMessage',

    'resetPassword',
  ],
  RouteManager: [
    'createRoute',
    'updateRoute',
    'deleteRoute',

    'createVehicle',
    'updateVehicle',
    'deleteVehicle',
  ],
  CrewLead: [
    'createTransportDay',
    'updateTransportDay',
    'deleteTransportDay',

    'updateTaxiExpense',

    'setOpeningBalance',
  ],
  DriverLead: [
    'createTransportDay',
    'updateTransportDay',
    'deleteTransportDay',

    'updateTaxiExpense',

    'setOpeningBalance',
  ],
  Accountant: [
    'createTariff',
    'updateTariff',
    'deleteTariff',

    'viewFinance',
    'generateSheet',
    'confirmSheet',
    'deleteSheet',
    'paySheet',
    'printSheet',
    'setOpeningBalance',
    'setAccountantBalance',

    'sendMessage',
  ],
}

export function hasCapability(roles: AppRole[], capability: Capability) {
  return roles.some((role) =>
    (roleCapabilities[role] ?? []).includes(capability),
  )
}
