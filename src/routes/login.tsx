import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import type { SubmitEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
// import { roleLabels } from '@/lib/app-types'
// import type { AppRole } from '@/lib/app-types'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

// The real accounts seeded by Backend/.../Seeders/UserDatabaseSeeder.cs — every
// seeded account shares one demo password (see DemoCredentials.Password there).
// const DEMO_PASSWORD = 'Passw0rd!'

// interface DemoAccount {
//   name: string
//   phoneNumber: string
//   role: AppRole
// }

// const demoAccounts: DemoAccount[] = [
//   { name: 'System Admin', phoneNumber: '+992900000000', role: 'admin' },
//   {
//     name: 'Bekzod Karimov',
//     phoneNumber: '+992900000001',
//     role: 'routeManager',
//   },
//   { name: 'Sardor Rahmonov', phoneNumber: '+992900000002', role: 'crewLead' },
//   { name: 'Rustam Aliyev', phoneNumber: '+992900000004', role: 'driverLead' },
//   { name: 'Aziz Yusupov', phoneNumber: '+992900000006', role: 'worker' },
//   {
//     name: 'Malika Sharipova',
//     phoneNumber: '+992900000016',
//     role: 'accountant',
//   },
// ]

function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const [formState, setFormState] = useState({ login: '', password: '' })
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/" />
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    const isLoggedIn = await login(formState)

    setIsSubmitting(false)

    if (!isLoggedIn) {
      setErrorMessage('Invalid login or password.')
      return
    }

    setErrorMessage('')
    // No manual navigate() here — `isAuthenticated` flipping true causes this
    // component (and __root.tsx) to re-render and redirect declaratively, which
    // guarantees the data providers in AuthenticatedProviders are already mounted
    // before the dashboard renders. An imperative navigate() here raced ahead of
    // that provider mount and crashed the dashboard with a missing-context error.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#d9f3ff_0%,#eef8fc_35%,#f7fbfd_100%)] px-4 py-10">
      <div className="w-full max-w-md rounded-[32px] border border-white/80 bg-white/92 p-8 shadow-[0_30px_80px_-48px_rgba(3,105,161,0.8)] backdrop-blur-xl">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-500">
            SRP Transportation
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Sign in
          </h1>
          <p className="text-sm leading-6 text-slate-500">
            Sign in with your phone number and password. What you can see and do
            depends on your role.
          </p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor="login"
            >
              Username
            </label>
            <Input
              id="login"
              value={formState.login}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  login: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor="password"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={formState.password}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder="••••••••"
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-rose-500">{errorMessage}</p>
          )}

          <Button
            className="h-11 w-full rounded-2xl bg-sky-600 text-white hover:bg-sky-700"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        {/* <div className="mt-8 border-t border-sky-100 pt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Demo accounts
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Seeded on the backend, one password for all: <code>{DEMO_PASSWORD}</code>
          </p>

          <div className="mt-3 grid gap-2">
            {demoAccounts.map((account) => (
              <button
                key={account.phoneNumber}
                type="button"
                className="flex items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-sky-50/50 px-3 py-2 text-left transition hover:border-sky-200 hover:bg-sky-50"
                onClick={() => {
                  setFormState({ login: account.phoneNumber, password: DEMO_PASSWORD })
                  setErrorMessage('')
                }}
              >
                <span className="truncate text-sm text-slate-700">{account.name}</span>
                <span className="shrink-0 text-xs font-medium text-sky-600">
                  {roleLabels[account.role]}
                </span>
              </button>
            ))}
          </div>
        </div> */}
      </div>
    </div>
  )
}
