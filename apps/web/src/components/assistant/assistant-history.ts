import type { UIMessage } from '@tanstack/ai-react'

export type Conversation = {
  id: string
  title: string
  updatedAt: number
  messages: UIMessage[]
}

export const HISTORY_LIMIT = 10
const PREFIX = 'assistant.history.v1'
/** Per signed-in user; localStorage so "recent conversations" outlive the tab. */
export const historyKey = (userKey: string) => `${PREFIX}:${userKey}`

export function titleOf(messages: ReadonlyArray<UIMessage>): string {
  for (const m of messages) {
    if (m.role !== 'user') continue
    const text = m.parts
      .map((p) => (p.type === 'text' ? p.content : ''))
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
    if (text) return text.length > 60 ? `${text.slice(0, 59)}…` : text
  }
  return ''
}

/** Newest first, one entry per conversation id, at most `HISTORY_LIMIT`. */
export function upsert(list: ReadonlyArray<Conversation>, next: Conversation): Conversation[] {
  return [next, ...list.filter((c) => c.id !== next.id)]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, HISTORY_LIMIT)
}

export function loadHistory(userKey: string): Conversation[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(historyKey(userKey)) ?? '[]') as unknown
    return Array.isArray(parsed) ? (parsed as Conversation[]).slice(0, HISTORY_LIMIT) : []
  } catch {
    return []
  }
}

export function saveHistory(userKey: string, list: ReadonlyArray<Conversation>) {
  try {
    if (list.length === 0) localStorage.removeItem(historyKey(userKey))
    else localStorage.setItem(historyKey(userKey), JSON.stringify(list))
  } catch {
    // storage unavailable or full: history is a convenience
  }
}
