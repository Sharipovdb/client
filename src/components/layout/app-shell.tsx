import { Link, useRouterState } from '@tanstack/react-router'
import {
  ChevronDown,
  ChevronLeft,
  KeyRound,
  LogOut,
  Menu,
  Moon,
  Sun,
  UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { getNavigationItemsForRole, getPageTitle } from '@/app/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { changeOwnPassword } from '@/features/account/change-own-password'
import { PasswordDialog } from '@/features/account/password-dialog'
import { useAuth } from '@/features/auth/auth-context'
import { MessagesBell } from '@/features/messages/messages-bell'
import { roleLabels } from '@/lib/app-types'
import { useThemePreference } from '@/lib/theme'
import type { ThemePreference } from '@/lib/theme'
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

const themeOptions: {
  value: ThemePreference
  label: string
  icon: LucideIcon
}[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

export function AppShell({ children }: AppShellProps) {
  const { session, logout } = useAuth()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [themePreference, setThemePreference] = useThemePreference()

  const visibleItems = session ? getNavigationItemsForRole(session.roles) : []

  const sidebarWidthClassName = sidebarCollapsed
    ? collapsedSidebarWidth
    : expandedSidebarWidth
  const contentOffsetClassName = sidebarCollapsed
    ? collapsedContentOffset
    : expandedContentOffset

  return (
    <div className="min-h-screen bg-(image:--app-backdrop) text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/96 backdrop-blur-xl">
        <div className="flex min-h-20 items-center justify-between gap-2 px-3 py-2 sm:min-h-26 sm:gap-4 sm:px-6 sm:py-4 lg:px-10">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              title="Open menu"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="size-4" />
            </Button>

            <BrandLogo collapsed={sidebarCollapsed} />
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-between gap-2 sm:gap-4 sm:border-l sm:border-border sm:pl-6 lg:pl-10">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
                {getPageTitle(pathname)}
              </h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <MessagesBell />

              {session && (
                // Non-modal so opening the password dialog from an item does not fight
                // the menu over focus and the body's pointer-events lock.
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={session.fullname}
                      className="group flex items-center gap-2 rounded-full border border-border bg-card p-1 text-left shadow-sm shadow-accent/80 transition outline-none hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/50 sm:gap-3 sm:px-3 sm:py-2"
                    >
                      <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground sm:size-10">
                        <UserRound className="size-5" />
                      </span>

                      <span className="hidden min-w-0 md:block">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {session.fullname}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {session.roles
                            .map((role) => roleLabels[role])
                            .join(', ')}
                        </span>
                      </span>

                      <ChevronDown className="mr-1 size-4 shrink-0 text-faint-foreground transition-transform group-data-[state=open]:rotate-180 sm:mr-0" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="flex items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <UserRound className="size-5" />
                      </span>

                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {session.fullname}
                        </span>
                        <span className="block truncate text-xs font-normal text-muted-foreground">
                          {session.roles
                            .map((role) => roleLabels[role])
                            .join(', ')}
                        </span>
                      </span>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onSelect={() => setChangingPassword(true)}
                    >
                      <KeyRound />
                      Change password
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuLabel className="px-3 py-1 text-xs font-medium text-muted-foreground">
                      Theme
                    </DropdownMenuLabel>

                    <DropdownMenuRadioGroup
                      value={themePreference}
                      onValueChange={(value) =>
                        setThemePreference(value as ThemePreference)
                      }
                    >
                      {themeOptions.map((option) => (
                        <DropdownMenuRadioItem
                          key={option.value}
                          value={option.value}
                          // Keep the menu open so the change can be seen and undone.
                          onSelect={(event) => event.preventDefault()}
                        >
                          <option.icon />
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onSelect={logout}>
                      <LogOut />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </header>

      <PasswordDialog
        open={changingPassword}
        onOpenChange={setChangingPassword}
        title="Change your password"
        description="You stay signed in on this device."
        submitLabel="Change password"
        askCurrentPassword
        onSubmit={({ currentPassword, newPassword }) =>
          changeOwnPassword(currentPassword, newPassword)
        }
      />

      <div className={cn('flex', belowHeaderMinHeight)}>
        <aside
          className={cn(
            'fixed left-0 z-20 flex w-70 max-w-[85vw] flex-col overflow-hidden bg-(image:--sidebar-backdrop) text-white shadow-[24px_0_80px_-36px_rgba(8,47,73,0.4)] transition-transform duration-300 lg:translate-x-0',
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
                          ? 'border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_14px_26px_-22px_rgba(3,105,161,0.85)]'
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
