import { Link, useRouterState } from '@tanstack/react-router'
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  LogOut,
  Menu,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { getNavigationItemsForRole, getPageTitle } from '@/app/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { roleLabels } from '@/lib/app-types'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
}

// The header is shorter on a phone, and the sidebar and content are positioned against
// it. Kept together so the three can never disagree about where the header ends.
const headerOffset = 'top-20 sm:top-26'
const belowHeaderHeight = 'h-[calc(100vh-5rem)] sm:h-[calc(100vh-6.5rem)]'
const belowHeaderMinHeight =
  'min-h-[calc(100vh-5rem)] sm:min-h-[calc(100vh-6.5rem)]'

const expandedSidebarWidth = 'lg:w-[280px]'
const collapsedSidebarWidth = 'lg:w-[112px]'
const expandedContentOffset = 'lg:ml-[280px]'
const collapsedContentOffset = 'lg:ml-[112px]'

export function AppShell({ children }: AppShellProps) {
  const { session, logout } = useAuth()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)

  const visibleItems = session ? getNavigationItemsForRole(session.roles) : []

  const sidebarWidthClassName = sidebarCollapsed
    ? collapsedSidebarWidth
    : expandedSidebarWidth
  const contentOffsetClassName = sidebarCollapsed
    ? collapsedContentOffset
    : expandedContentOffset

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef9fc_0%,#f8fcfe_32%,#f4f9fc_100%)] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-sky-100/80 bg-white/96 backdrop-blur-xl">
        <div className="flex min-h-20 items-center justify-between gap-2 px-3 py-2 sm:min-h-26 sm:gap-4 sm:px-6 sm:py-4 lg:px-10">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="size-4" />
            </Button>

            <BrandLogo collapsed={sidebarCollapsed} />
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-between gap-2 sm:gap-4 sm:border-l sm:border-sky-100 sm:pl-6 lg:pl-10">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
                {getPageTitle(pathname)}
              </h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="icon"
                className="hidden rounded-full border-sky-100 text-sky-600 sm:inline-flex"
              >
                <Bell className="size-4" />
              </Button>

              {session && (
                <div className="relative">
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-sky-100 bg-white p-1 text-left shadow-sm shadow-sky-100/80 transition hover:border-sky-200 sm:gap-3 sm:px-3 sm:py-2"
                    onClick={() => setProfileMenuOpen((current) => !current)}
                  >
                    <span className="flex size-9 items-center justify-center rounded-full bg-sky-100 text-sky-700 sm:size-10">
                      <UserRound className="size-5" />
                    </span>

                    <span className="hidden min-w-0 md:block">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {session.fullname}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {session.roles
                          .map((role) => roleLabels[role])
                          .join(', ')}
                      </span>
                    </span>

                    <ChevronDown
                      className={cn(
                        'mr-1 size-4 shrink-0 text-slate-400 transition-transform sm:mr-0',
                        profileMenuOpen && 'rotate-180',
                      )}
                    />
                  </button>

                  {profileMenuOpen && (
                    <div className="absolute right-0 top-[calc(100%+0.75rem)] w-64 rounded-[24px] border border-sky-100 bg-white p-4 shadow-[0_24px_60px_-32px_rgba(14,116,144,0.45)]">
                      <div className="flex items-center gap-3">
                        <span className="flex size-11 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                          <UserRound className="size-5" />
                        </span>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {session.fullname}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {session.roles
                              .map((role) => roleLabels[role])
                              .join(', ')}
                          </p>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        className="mt-4 h-11 w-full rounded-2xl border-sky-100 text-sky-700"
                        onClick={() => {
                          setProfileMenuOpen(false)
                          logout()
                        }}
                      >
                        <LogOut className="size-4" />
                        Logout
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className={cn('flex', belowHeaderMinHeight)}>
        <aside
          className={cn(
            'fixed left-0 z-20 flex w-70 max-w-[85vw] flex-col overflow-hidden bg-[linear-gradient(180deg,#1495cf_0%,#1f9dd3_38%,#2ba6d8_100%)] text-white shadow-[24px_0_80px_-36px_rgba(8,47,73,0.4)] transition-transform duration-300 lg:translate-x-0',
            headerOffset,
            belowHeaderHeight,
            sidebarWidthClassName,
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col px-4 py-5">
            <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto pr-1">
              <nav className="space-y-2">
                {visibleItems.map((item) => {
                  const isActive =
                    item.to === '/'
                      ? pathname === '/'
                      : pathname === item.to ||
                        pathname.startsWith(`${item.to}/`)

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileSidebarOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'border-white bg-white text-sky-700 shadow-[0_14px_26px_-22px_rgba(3,105,161,0.85)]'
                          : 'border-white/55 bg-white/6 text-white/90 hover:bg-white/12',
                        sidebarCollapsed && 'justify-center px-3',
                      )}
                    >
                      <item.icon className="size-5 shrink-0" />
                      {!sidebarCollapsed && <span>{item.title}</span>}
                    </Link>
                  )
                })}
              </nav>
            </div>

            <div className="mt-5 hidden border-t border-white/35 pt-5 lg:block">
              <Button
                variant="secondary"
                className="w-full justify-center rounded-full border border-white/20 bg-white/12 text-white hover:bg-white/18"
                onClick={() => setSidebarCollapsed((current) => !current)}
              >
                <ChevronLeft
                  className={cn(
                    'size-4 transition-transform',
                    sidebarCollapsed && 'rotate-180',
                  )}
                />
                {!sidebarCollapsed && 'Collapse menu'}
              </Button>
            </div>
          </div>
        </aside>

        {mobileSidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            className={cn(
              'fixed inset-0 z-10 bg-slate-950/30 lg:hidden',
              headerOffset,
            )}
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col',
            belowHeaderMinHeight,
            contentOffsetClassName,
          )}
        >
          <main className="min-w-0 flex-1 px-3 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

function BrandLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <img
      src="/logosrp.png"
      alt="SRP Transportation"
      className={cn(
        'h-10 w-auto shrink-0 object-contain sm:h-16 lg:h-20',
        collapsed && 'lg:h-16',
      )}
    />
  )
}
