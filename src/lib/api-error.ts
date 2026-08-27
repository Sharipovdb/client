import { isAxiosError } from 'axios'

// The backend has two different error shapes depending on the endpoint (see
// api-client.ts): Auth endpoints always return HTTP 200 with `{isSuccess:false,
// message}`; every other controller returns a real error status with an RFC7807
// ProblemDetails body (`{title, detail, extensions: {errors}}`). This is the one
// place that turns either shape into a plain, displayable message.
export function getErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; title?: string; detail?: string; errors?: Record<string, string[]> }
      | undefined

    if (data?.errors) {
      return Object.values(data.errors).flat().join(' ')
    }

    return data?.message ?? data?.detail ?? data?.title ?? error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}
