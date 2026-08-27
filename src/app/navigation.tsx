import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  Bus,
  Car,
  CreditCard,
  LayoutDashboard,
  Map,
  Receipt,
  Coins,
  Route,
  Truck,
} from 'lucide-react'

import type { AppRole } from '@/lib/app-types'
import { appPagePaths, canAccessPath } from '@/lib/permissions'

export interface NavigationItem {
  title: string
  to: string
  icon: LucideIcon
}

// Who may open each page lives in `lib/permissions.ts` — this list only decides
// order and presentation.
export const navigationItems: NavigationItem[] = [
  { title: 'Dashboard', to: appPagePaths.dashboard, icon: LayoutDashboard },
  { title: 'Employees', to: appPagePaths.employees, icon: Briefcase },
  { title: 'Crews', to: appPagePaths.crews, icon: Bus },
  { title: 'Transport Days', to: appPagePaths.transportDays, icon: Route },
  { title: 'Tariffs', to: appPagePaths.tariffs, icon: Coins },
  { title: 'Routes', to: appPagePaths.routes, icon: Map },
  { title: 'Vehicles', to: appPagePaths.vehicles, icon: Car },
  { title: 'Taxi Expenses', to: appPagePaths.taxiExpenses, icon: Receipt },
  { title: 'Payouts', to: appPagePaths.payouts, icon: CreditCard },
  { title: 'Monthly Sheets', to: appPagePaths.monthlySheets, icon: Truck },
]

export function getNavigationItemsForRole(roles: AppRole[]) {
  return navigationItems.filter((item) => canAccessPath(roles, item.to))
}

export function getPageTitle(pathname: string) {
  const matchedItem = navigationItems.find((item) =>
    item.to === appPagePaths.dashboard
      ? pathname === appPagePaths.dashboard
      : pathname === item.to || pathname.startsWith(`${item.to}/`),
  )

  return matchedItem?.title ?? 'SRP Transportation'
}
