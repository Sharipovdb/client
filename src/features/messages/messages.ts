// Announcements the accountant and the admin send to everyone, read behind the bell in
// the header. The API shape matches MessageDto one-to-one.
export interface Message {
  id: number
  text: string
  authorId: number
  authorFullname: string
  createdAt: string // ISO timestamp
  // Whether the signed-in user has opened it; their own messages are always read.
  isRead: boolean
}

const BADGE_LIMIT = 9

/** What the red dot on the bell says; `null` hides it. */
export function unreadBadgeLabel(count: number) {
  if (count <= 0) return null

  return count > BADGE_LIMIT ? `${BADGE_LIMIT}+` : String(count)
}

/**
 * The newest message shown, once anything shown is unread. Reading is tracked as "every
 * message up to this id", so marking up to the newest one the user actually saw never
 * swallows a message that arrived after the list was loaded.
 */
export function lastIdToMarkRead(messages: Message[]) {
  if (!messages.some((message) => !message.isRead)) return null

  return Math.max(...messages.map((message) => message.id))
}

interface MessageDeleter {
  id: number
  roles: readonly string[]
}

/** The same rule as the backend's Delete: the author, or an admin for any message. */
export function canDeleteMessage(message: Message, user: MessageDeleter) {
  return message.authorId === user.id || user.roles.includes('Admin')
}
