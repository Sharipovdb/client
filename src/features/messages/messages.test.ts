import { describe, expect, it } from 'vitest'

import {
  canDeleteMessage,
  lastIdToMarkRead,
  unreadBadgeLabel,
} from './messages'
import type { Message } from './messages'

function aMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    text: 'Payouts are on Friday',
    authorId: 7,
    authorFullname: 'Abbos Kamolov',
    createdAt: '2026-10-29T08:00:00.000Z',
    isRead: true,
    ...overrides,
  }
}

describe('unreadBadgeLabel', () => {
  it('shows no badge while everything is read', () => {
    expect(unreadBadgeLabel(0)).toBeNull()
  })

  it('shows the count up to nine', () => {
    expect(unreadBadgeLabel(1)).toBe('1')
    expect(unreadBadgeLabel(9)).toBe('9')
  })

  it('caps a longer backlog at 9+', () => {
    expect(unreadBadgeLabel(10)).toBe('9+')
  })
})

describe('lastIdToMarkRead', () => {
  it('marks up to the newest message once any shown message is unread', () => {
    const messages = [
      aMessage({ id: 12, isRead: true }),
      aMessage({ id: 11, isRead: false }),
      aMessage({ id: 10, isRead: true }),
    ]

    expect(lastIdToMarkRead(messages)).toBe(12)
  })

  it('has nothing to mark when every shown message is read', () => {
    expect(
      lastIdToMarkRead([aMessage({ id: 3 }), aMessage({ id: 2 })]),
    ).toBeNull()
  })

  it('has nothing to mark without messages', () => {
    expect(lastIdToMarkRead([])).toBeNull()
  })
})

describe('canDeleteMessage', () => {
  const message = aMessage({ authorId: 7 })

  it('lets the author delete their message', () => {
    expect(canDeleteMessage(message, { id: 7, roles: ['Accountant'] })).toBe(
      true,
    )
  })

  it('keeps another accountant from deleting it', () => {
    expect(canDeleteMessage(message, { id: 8, roles: ['Accountant'] })).toBe(
      false,
    )
  })

  it('lets an admin delete any message', () => {
    expect(canDeleteMessage(message, { id: 9, roles: ['Admin'] })).toBe(true)
  })
})
