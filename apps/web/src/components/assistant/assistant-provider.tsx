import { type JSONSchema, toolDefinition } from '@tanstack/ai'
import { fetchServerSentEvents } from '@tanstack/ai-client'
import { useChat } from '@tanstack/ai-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { getApprovalToolsFn } from '@/server/agent-approval-tools'
import { type Conversation, loadHistory, saveHistory, titleOf, upsert } from './assistant-history'
import { storageKey, threadKey } from './assistant-storage'
import { createClientTools } from './client-tools'

type Message = ReturnType<typeof useChat>['messages'][number]

function newThreadId(userKey: string, scope = 'chat', renew = false) {
  const key = scope === 'chat' ? threadKey(userKey) : `${threadKey(userKey)}:${scope}`
  try {
    const existing = renew ? null : sessionStorage.getItem(key)
    if (existing) return existing
    const id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}

function loadMessages(userKey: string): Message[] {
  try {
    const raw = sessionStorage.getItem(storageKey(userKey))
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? (parsed as Message[]) : []
  } catch {
    return []
  }
}

function saveMessages(userKey: string, messages: ReadonlyArray<Message>) {
  try {
    if (messages.length === 0) sessionStorage.removeItem(storageKey(userKey))
    else sessionStorage.setItem(storageKey(userKey), JSON.stringify(messages.slice(-60)))
  } catch {
    // storage unavailable (private mode / quota): the conversation simply is not restored on reload
  }
}

/** What the user is looking at, sent with every request (the server validates it again). */
function pageContext(pathname: string) {
  const doc = /^\/faktury\/([A-Za-z0-9_-]+)(?:\/upravit)?$/.exec(pathname)
  const entity = doc?.[1] && doc[1] !== 'nova' ? { type: 'document', id: doc[1] } : undefined
  return { route: pathname, ...(entity ? { entity } : {}) }
}

export type AssistantApi = Pick<
  ReturnType<typeof useChat>,
  'messages' | 'isLoading' | 'stop' | 'error' | 'clear'
> & {
  /** Recent conversations of this user, newest first (this browser only). */
  history: ReadonlyArray<Conversation>
  openConversation: (id: string) => void
  clearHistory: () => void
  interrupts: ReadonlyArray<unknown>
  resolveInterrupts: (approved: boolean) => void
  send: (text: string) => Promise<void>
}

const AssistantContext = createContext<AssistantApi | null>(null)

export function useAssistant() {
  const ctx = useContext(AssistantContext)
  if (!ctx) throw new Error('useAssistant must be used inside AssistantProvider')
  return ctx
}

/**
 * Owns the conversation for the whole app shell, so it survives navigation and closing the panel.
 * `pendingQuestion` (from ⌘K) is sent once when it changes.
 */
export function AssistantProvider({
  userKey,
  pendingQuestion,
  children,
}: {
  userKey: string
  pendingQuestion: { id: number; text: string } | null
  children: ReactNode
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const contextRef = useRef(pageContext(pathname))
  contextRef.current = pageContext(pathname)

  const queryClient = useQueryClient()
  const approvalTools = useQuery({
    queryKey: ['assistant', 'approval-tools'],
    queryFn: async () =>
      JSON.parse(await getApprovalToolsFn()) as {
        name: string
        description: string
        inputSchema: unknown
      }[],
    staleTime: Number.POSITIVE_INFINITY,
  })
  // Approval-gated server tools are declared (no execute) so the client can bind and resolve their interrupts.
  const tools = useMemo(
    () => [
      ...createClientTools((o) => navigate(o as never)),
      ...(approvalTools.data ?? []).map((t) =>
        toolDefinition({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema as JSONSchema,
          needsApproval: true as const,
        }).client(),
      ),
    ],
    [navigate, approvalTools.data],
  )
  const connection = useMemo(
    () => fetchServerSentEvents('/api/agent', () => ({ body: { context: contextRef.current } })),
    [],
  )

  const threadId = useRef(newThreadId(userKey)).current
  const chat = useChat({
    threadId,
    connection,
    tools,
    initialMessages: loadMessages(userKey) as never,
  })

  useEffect(() => saveMessages(userKey, chat.messages), [userKey, chat.messages])

  // The history id is separate from the chat thread: "new conversation" starts a new entry.
  const conversationId = useRef(newThreadId(userKey, 'conv'))
  const [history, setHistory] = useState<Conversation[]>(() => loadHistory(userKey))
  useEffect(() => {
    if (chat.isLoading || chat.messages.length === 0) return
    setHistory((list) => {
      const next = upsert(list, {
        id: conversationId.current,
        title: titleOf(chat.messages),
        updatedAt: Date.now(),
        messages: chat.messages.slice(-60) as never,
      })
      saveHistory(userKey, next)
      return next
    })
  }, [userKey, chat.messages, chat.isLoading])

  const { clear: clearChat, setMessages } = chat
  const clear = useCallback(() => {
    clearChat()
    conversationId.current = newThreadId(userKey, 'conv', true)
  }, [clearChat, userKey])
  const openConversation = useCallback(
    (id: string) => {
      const found = loadHistory(userKey).find((c) => c.id === id)
      if (!found) return
      conversationId.current = id
      try {
        sessionStorage.setItem(`${threadKey(userKey)}:conv`, id)
      } catch {
        // storage unavailable
      }
      setMessages(found.messages as never)
    },
    [userKey, setMessages],
  )
  const clearHistory = useCallback(() => {
    saveHistory(userKey, [])
    setHistory([])
  }, [userKey])

  // The assistant changes data through the same API as the UI: refresh whatever the user is looking at.
  const wasLoading = useRef(false)
  useEffect(() => {
    if (wasLoading.current && !chat.isLoading) void queryClient.invalidateQueries()
    wasLoading.current = chat.isLoading
  }, [chat.isLoading, queryClient])

  const send = useCallback((text: string) => chat.sendMessage(text), [chat.sendMessage])

  const lastQuestion = useRef<number | null>(null)
  useEffect(() => {
    if (!pendingQuestion || lastQuestion.current === pendingQuestion.id) return
    lastQuestion.current = pendingQuestion.id
    void send(pendingQuestion.text)
  }, [pendingQuestion, send])

  const api = useMemo<AssistantApi>(
    () => ({
      messages: chat.messages,
      isLoading: chat.isLoading,
      stop: chat.stop,
      error: chat.error,
      interrupts: chat.interrupts,
      resolveInterrupts: chat.resolveInterrupts,
      clear,
      history,
      openConversation,
      clearHistory,
      send,
    }),
    [
      chat.messages,
      chat.isLoading,
      chat.stop,
      chat.error,
      chat.interrupts,
      chat.resolveInterrupts,
      clear,
      history,
      openConversation,
      clearHistory,
      send,
    ],
  )

  return <AssistantContext.Provider value={api}>{children}</AssistantContext.Provider>
}
