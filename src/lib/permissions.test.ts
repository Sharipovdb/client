import { describe, expect, it } from 'vitest'

import { getNavigationItemsForRole } from '@/app/navigation'
import { appPagePaths, canAccessPath, hasCapability } from '@/lib/permissions'

const {
  dashboard,
  payouts,
  monthlySheets,
  employees,
  crews,
  transportDays,
  taxiExpenses,
  vehicles,
} = appPagePaths

// A session carries a list of roles, so every assertion passes one — a single-role
// array is the common case.
const admin = ['Admin'] as const
const accountant = ['Accountant'] as const
const routeManager = ['RouteManager'] as const
const crewLead = ['CrewLead'] as const
const driverLead = ['DriverLead'] as const
const worker = ['Worker'] as const

describe('page access', () => {
  it('admin can open every page', () => {
    for (const path of Object.values(appPagePaths)) {
      expect(canAccessPath([...admin], path)).toBe(true)
    }
  })

  it('worker only gets the dashboard', () => {
    expect(canAccessPath([...worker], dashboard)).toBe(true)
    expect(
      getNavigationItemsForRole([...worker]).map((item) => item.to),
    ).toEqual([dashboard])
  })

  it('route manager handles assignment but no finance', () => {
    expect(canAccessPath([...routeManager], employees)).toBe(true)
    expect(canAccessPath([...routeManager], crews)).toBe(true)
    expect(canAccessPath([...routeManager], payouts)).toBe(false)
    expect(canAccessPath([...routeManager], monthlySheets)).toBe(false)
  })

  it('crew lead works its crew, not payroll or the directory', () => {
    expect(canAccessPath([...crewLead], taxiExpenses)).toBe(true)
    expect(canAccessPath([...crewLead], payouts)).toBe(false)
    expect(canAccessPath([...crewLead], employees)).toBe(false)
  })

  it('both lead kinds log days, and neither administers vehicles', () => {
    expect(canAccessPath([...driverLead], transportDays)).toBe(true)
    expect(canAccessPath([...crewLead], transportDays)).toBe(true)
    expect(canAccessPath([...driverLead], vehicles)).toBe(false)
    expect(canAccessPath([...crewLead], vehicles)).toBe(false)
  })

  it('both lead kinds open the monthly sheets of their crew', () => {
    expect(canAccessPath([...driverLead], monthlySheets)).toBe(true)
    expect(canAccessPath([...crewLead], monthlySheets)).toBe(true)
  })

  it('accountant sees the finance pages but not the directory', () => {
    expect(canAccessPath([...accountant], payouts)).toBe(true)
    expect(canAccessPath([...accountant], monthlySheets)).toBe(true)
    expect(canAccessPath([...accountant], employees)).toBe(false)
  })

  it('nested paths inherit access, and dashboard stays exact', () => {
    expect(canAccessPath([...admin], `${crews}/crew-001`)).toBe(true)
    expect(canAccessPath([...worker], `${crews}/crew-001`)).toBe(false)
    // '/' must not act as a prefix for every route
    expect(canAccessPath([...worker], payouts)).toBe(false)
  })

  it('multiple roles union their access', () => {
    expect(canAccessPath([...worker, ...accountant], payouts)).toBe(true)
  })
})

describe('capabilities', () => {
  // Pricing, confirming and paying the sheet stay the accountant's, as on the backend's
  // Generate, Confirm and MarkPaid. A lead only reads it and enters their own advance.
  it('the accountant owns the sheet; a lead does not', () => {
    expect(hasCapability([...accountant], 'generateSheet')).toBe(true)
    expect(hasCapability([...accountant], 'confirmSheet')).toBe(true)
    expect(hasCapability([...accountant], 'deleteSheet')).toBe(true)
    expect(hasCapability([...crewLead], 'confirmSheet')).toBe(false)
    expect(hasCapability([...crewLead], 'generateSheet')).toBe(false)
  })

  it('money is limited to admin and accountant', () => {
    expect(hasCapability([...admin], 'viewFinance')).toBe(true)
    expect(hasCapability([...accountant], 'viewFinance')).toBe(true)
    expect(hasCapability([...crewLead], 'viewFinance')).toBe(false)
    expect(hasCapability([...routeManager], 'viewFinance')).toBe(false)
    expect(hasCapability([...worker], 'viewFinance')).toBe(false)
  })

  it('a lead reads the monthly sheet without settling it', () => {
    for (const capability of [
      'generateSheet',
      'confirmSheet',
      'deleteSheet',
      'paySheet',
      'printSheet',
    ] as const) {
      expect(hasCapability([...driverLead], capability)).toBe(false)
      expect(hasCapability([...crewLead], capability)).toBe(false)
      expect(hasCapability([...accountant], capability)).toBe(true)
    }
  })

  it('both lead kinds enter their advance, as does whoever prices the sheet', () => {
    expect(hasCapability([...crewLead], 'setOpeningBalance')).toBe(true)
    expect(hasCapability([...driverLead], 'setOpeningBalance')).toBe(true)
    expect(hasCapability([...accountant], 'setOpeningBalance')).toBe(true)
    expect(hasCapability([...admin], 'setOpeningBalance')).toBe(true)
    expect(hasCapability([...routeManager], 'setOpeningBalance')).toBe(false)
    expect(hasCapability([...worker], 'setOpeningBalance')).toBe(false)
  })

  it('only accountant/admin write messages; everyone else only reads them', () => {
    expect(hasCapability([...accountant], 'sendMessage')).toBe(true)
    expect(hasCapability([...admin], 'sendMessage')).toBe(true)
    expect(hasCapability([...crewLead], 'sendMessage')).toBe(false)
    expect(hasCapability([...driverLead], 'sendMessage')).toBe(false)
    expect(hasCapability([...routeManager], 'sendMessage')).toBe(false)
    expect(hasCapability([...worker], 'sendMessage')).toBe(false)
  })

  it('only accountant/admin record the money received for the month', () => {
    expect(hasCapability([...accountant], 'setAccountantBalance')).toBe(true)
    expect(hasCapability([...admin], 'setAccountantBalance')).toBe(true)
    expect(hasCapability([...crewLead], 'setAccountantBalance')).toBe(false)
    expect(hasCapability([...driverLead], 'setAccountantBalance')).toBe(false)
    expect(hasCapability([...routeManager], 'setAccountantBalance')).toBe(false)
    expect(hasCapability([...worker], 'setAccountantBalance')).toBe(false)
  })

  it('only accountant/admin settle a crew payout', () => {
    expect(hasCapability([...accountant], 'paySheet')).toBe(true)
    expect(hasCapability([...admin], 'paySheet')).toBe(true)
    expect(hasCapability([...crewLead], 'paySheet')).toBe(false)
    expect(hasCapability([...driverLead], 'paySheet')).toBe(false)
    expect(hasCapability([...routeManager], 'paySheet')).toBe(false)
  })

  it('leads log the day and correct its fare; the accountant does neither', () => {
    expect(hasCapability([...crewLead], 'createTransportDay')).toBe(true)
    expect(hasCapability([...driverLead], 'deleteTransportDay')).toBe(true)
    expect(hasCapability([...driverLead], 'updateTaxiExpense')).toBe(true)
    expect(hasCapability([...accountant], 'createTransportDay')).toBe(false)
    expect(hasCapability([...accountant], 'updateTaxiExpense')).toBe(false)
  })

  it('the route manager owns the fleet and the routes, not the money', () => {
    expect(hasCapability([...routeManager], 'createRoute')).toBe(true)
    expect(hasCapability([...routeManager], 'deleteVehicle')).toBe(true)
    expect(hasCapability([...routeManager], 'viewFinance')).toBe(false)
    expect(hasCapability([...crewLead], 'createVehicle')).toBe(false)
  })

  it('a worker has no capability at all', () => {
    expect(hasCapability([...worker], 'createTransportDay')).toBe(false)
    expect(hasCapability([...worker], 'viewFinance')).toBe(false)
    expect(hasCapability([...worker], 'paySheet')).toBe(false)
  })

  it('only an admin resets the password of someone else', () => {
    expect(hasCapability([...admin], 'resetPassword')).toBe(true)
    expect(hasCapability([...routeManager], 'resetPassword')).toBe(false)
    expect(hasCapability([...accountant], 'resetPassword')).toBe(false)
  })
})
