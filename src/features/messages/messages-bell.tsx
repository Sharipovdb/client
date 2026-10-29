import { Bell, Megaphone, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/auth-context'
import { usePermissions } from '@/features/auth/use-permissions'
import {
  canDeleteMessage,
  lastIdToMarkRead,
  unreadBadgeLabel,
} from '@/features/messages/messages'
import type { Message } from '@/features/messages/messages'
import {
  useDeleteMessage,
  useLatestMessages,
  useMarkMessagesRead,
  useSendMessage,
  useUnreadMessageCount,
} from '@/features/messages/messages-api'
import { getErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'

const TEXT_MAX_LENGTH = 2000

function formatSentAt(isoTimestamp: string) {
  return new Date(isoTimestamp).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function MessageComposer() {
  const sendMutation = useSendMessage()
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const trimmed = text.trim()

  async function handleSend(event: FormEvent) {
    event.preventDefault()
    if (trimmed === '') return

    setError('')

    try {
      await sendMutation.mutateAsync(trimmed)
      setText('')
    } catch (sendError) {
      setError(getErrorMessage(sendError, 'Could not send the message.'))
    }
  }

  return (
    <form className="space-y-2" onSubmit={handleSend}>
      <Textarea
        aria-label="New message"
        className="min-h-20 resize-y"
        placeholder="Write a message to everyone…"
        maxLength={TEXT_MAX_LENGTH}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-faint-foreground">
          {text.length} / {TEXT_MAX_LENGTH}
        </span>
        <Button
          type="submit"
          disabled={trimmed === '' || sendMutation.isPending}
        >
          <Megaphone className="size-4" />
          Send to everyone
        </Button>
      </div>
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </form>
  )
}

interface MessageItemProps {
  message: Message
  canDelete: boolean
  onDelete: (message: Message) => void
}

function MessageItem({ message, canDelete, onDelete }: MessageItemProps) {
  return (
    <li
      className={cn(
        'rounded-2xl border p-4',
        message.isRead
          ? 'border-border bg-card'
          : 'border-primary/30 bg-accent/60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {!message.isRead && (
              <span
                className="size-2 shrink-0 rounded-full bg-primary"
                aria-label="Unread"
              />
            )}
            <span className="truncate">{message.authorFullname}</span>
          </p>
          <p className="text-xs text-faint-foreground">
            {formatSentAt(message.createdAt)}
          </p>
        </div>

        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-faint-foreground hover:text-destructive"
            title="Delete this message"
            onClick={() => onDelete(message)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>

      <p className="mt-2 text-sm leading-6 break-words whitespace-pre-wrap text-soft-foreground">
        {message.text}
      </p>
    </li>
  )
}

/**
 * The bell in the header. Anyone signed in reads the announcements the accountant and
 * the admin send to everyone; only those two can write or delete one, and there are no
 * replies. Opening the panel marks what it shows as read.
 */
export function MessagesBell() {
  const { session } = useAuth()
  const { can } = usePermissions()
  const [isOpen, setIsOpen] = useState(false)
  const [deletingMessage, setDeletingMessage] = useState<Message | null>(null)
  const [actionError, setActionError] = useState('')

  const { data: unreadCount = 0 } = useUnreadMessageCount(session !== null)
  const { data: messages = [], isLoading } = useLatestMessages(isOpen)
  const { mutate: markRead } = useMarkMessagesRead()
  const deleteMutation = useDeleteMessage()

  // Marking read does not reload the list, so the same unread messages would ask again
  // on every render; remembering the last id sent stops that.
  const lastMarkedId = useRef<number | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const lastReadId = lastIdToMarkRead(messages)

    if (lastReadId !== null && lastReadId !== lastMarkedId.current) {
      lastMarkedId.current = lastReadId
      markRead(lastReadId)
    }
  }, [isOpen, messages, markRead])

  if (!session) return null

  const badge = unreadBadgeLabel(unreadCount)

  async function handleDelete(message: Message) {
    setDeletingMessage(null)
    setActionError('')

    try {
      await deleteMutation.mutateAsync(message.id)
    } catch (deleteError) {
      setActionError(
        getErrorMessage(deleteError, 'Could not delete the message.'),
      )
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="relative rounded-full border-border text-primary"
        title="Messages"
        aria-label={badge ? `Messages, ${badge} unread` : 'Messages'}
        onClick={() => setIsOpen(true)}
      >
        <Bell className="size-4" />
        {badge && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[0.65rem] font-semibold text-white">
            {badge}
          </span>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Messages</DialogTitle>
            <DialogDescription>
              Announcements from the accountant and the admin.
            </DialogDescription>
          </DialogHeader>

          {can('sendMessage') && <MessageComposer />}

          {actionError && (
            <p className="text-xs font-medium text-destructive">
              {actionError}
            </p>
          )}

          {isLoading ? (
            <p className="py-8 text-center text-faint-foreground">Loading…</p>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Bell className="size-8 text-primary/40" />
              <p className="text-muted-foreground">No messages yet.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {messages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  canDelete={
                    can('sendMessage') && canDeleteMessage(message, session)
                  }
                  onDelete={setDeletingMessage}
                />
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deletingMessage !== null}
        onOpenChange={(open) => !open && setDeletingMessage(null)}
        tone="destructive"
        title="Delete this message?"
        description="It disappears for everyone. This cannot be undone."
        onConfirm={() => deletingMessage && handleDelete(deletingMessage)}
      />
    </>
  )
}
