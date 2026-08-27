import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'

import { AppProvider } from '@/app/app-provider'
import { AppQueryClientProvider } from '@/app/query-client'
import { getRouter } from '@/router'

const router = getRouter()

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <AppQueryClientProvider>
      <AppProvider>
        <RouterProvider router={router} />
      </AppProvider>
    </AppQueryClientProvider>,
  )
}
