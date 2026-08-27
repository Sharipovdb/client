import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'

import { clearAuth, getAuthTokens, setAuthTokens } from './auth-tokens'

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retried?: boolean
}

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:8080'

// The wrapper shape returned only by /api/Auth/* (see AuthService.cs) — every other
// controller returns its DTO directly with a real HTTP status code.
export interface ApiResponse<T> {
  isSuccess: boolean
  statusCode: number
  message: string | null
  data: T | null
}

export const apiClient = axios.create({ baseURL: API_BASE_URL })

// A bare instance for the refresh call itself — it must never carry an
// (expired) access token or run back through the 401 interceptor below.
const refreshClient = axios.create({ baseURL: API_BASE_URL })

apiClient.interceptors.request.use((config) => {
  const tokens = getAuthTokens()

  if (tokens) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`
  }

  return config
})

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const tokens = getAuthTokens()

  if (!tokens) {
    return null
  }

  try {
    const response = await refreshClient.post<
      ApiResponse<{ accessToken: string; refreshToken: string }>
    >('/api/Auth/refresh', { refreshToken: tokens.refreshToken })

    if (!response.data.isSuccess || !response.data.data) {
      return null
    }

    setAuthTokens(response.data.data)
    return response.data.data.accessToken
  } catch {
    return null
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retried
    ) {
      return Promise.reject(error)
    }

    originalRequest._retried = true

    // Share one in-flight refresh across every request that 401s at the same time.
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null
    })

    const newAccessToken = await refreshPromise

    if (!newAccessToken) {
      // Clear session too (not just tokens) so the reloaded app sees "logged out" and
      // stops firing authed queries — otherwise it 401s again and loops. And never
      // reload when already on /login, which would blink the page forever.
      clearAuth()

      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }

      return Promise.reject(error)
    }

    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
    return apiClient(originalRequest)
  },
)
