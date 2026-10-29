import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Message } from '@/features/messages/messages'
import { apiClient } from '@/lib/api-client'

interface PaginatedResult<T> {
  items: T[]
  totalCount: number
}

const MESSAGES_QUERY_KEY = ['messages']
const UNREAD_COUNT_QUERY_KEY = [...MESSAGES_QUERY_KEY, 'unread-count']

// The panel shows the latest announcements, not an archive.
const LATEST_MESSAGE_COUNT = 50

// There is no push from the server: the bell asks for its count now and then, which is
// plenty for announcements and keeps the backend a plain request/response API.
const UNREAD_POLL_INTERVAL_MS = 30_000

async function fetchLatestMessages() {
  const response = await apiClient.get<PaginatedResult<Message>>(
    '/api/Messages/GetAll',
    {
      params: {
        'PaginationInfo.Index': 0,
        'PaginationInfo.Size': LATEST_MESSAGE_COUNT,
      },
    },
  )

  return response.data.items
}

async function fetchUnreadCount() {
  const response = await apiClient.get<{ count: number }>(
    '/api/Messages/GetUnreadCount',
  )

  return response.data.count
}

/**
 * Loaded only while the panel is open, and not refreshed by marking it read: the
 * messages that were new when it opened stay highlighted until it is opened again.
 */
export function useLatestMessages(isOpen: boolean) {
  return useQuery({
    queryKey: [...MESSAGES_QUERY_KEY, 'latest'],
    queryFn: fetchLatestMessages,
    enabled: isOpen,
  })
}

export function useUnreadMessageCount(isSignedIn: boolean) {
  return useQuery({
    queryKey: UNREAD_COUNT_QUERY_KEY,
    queryFn: fetchUnreadCount,
    enabled: isSignedIn,
    refetchInterval: UNREAD_POLL_INTERVAL_MS,
  })
}

export function useMarkMessagesRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (lastReadId: number) =>
      apiClient.put('/api/Messages/MarkRead', { lastReadId }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY }),
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (text: string) =>
      apiClient.post<Message>('/api/Messages/Create', { text }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY }),
  })
}

export function useDeleteMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (messageId: number) =>
      apiClient.delete(`/api/Messages/Delete/${messageId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY }),
  })
}
