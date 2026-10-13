import { apiClient } from '@/lib/api-client'
import type { ApiResponse } from '@/lib/api-client'
import { ensureSucceeded } from '@/lib/api-response'

// The session stays open: only a password reset by an admin signs the person out.
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
) {
  const response = await apiClient.put<ApiResponse<null>>(
    '/api/User/ChangePassword',
    { currentPassword, newPassword },
  )

  ensureSucceeded(response.data, 'Could not change the password.')
}
