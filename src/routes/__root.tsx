import {
  Navigate,
  Outlet,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import { AppShell } from '@/components/layout/app-shell'
import { useAuth } from '@/features/auth/auth-context'
import { canAccessPath } from '@/lib/permissions'

import '../styles.css'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const { session, isAuthenticated } = useAuth()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const isLoginRoute = pathname === '/login'

  if (!isAuthenticated && !isLoginRoute) {
    return <Navigate to="/login" />
  }

  if (isAuthenticated && isLoginRoute) {
    return <Navigate to="/" />
  }

  // Guards every page in one place, so typing a URL cannot bypass the sidebar filter.
  if (session && !isLoginRoute && !canAccessPath(session.roles, pathname)) {
    return <Navigate to="/" />
  }

  const content = isLoginRoute ? (
    <Outlet />
  ) : (
    <AppShell>
      <Outlet />
    </AppShell>
  )

  return (
    <>
      {content}
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </>
  )
}
