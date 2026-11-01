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
} from 'react'
import { getApprovalToolsFn } from '@/server/agent-approval-tools'
import { createClientTools } from './client-tools'

const STORAGE_KEY = 'assistant.messages.v1'
const THREAD_KEY = 'assistant.thread.v1'

type Message = ReturnType<typeof useChat>['messages'][number]

function newThreadId() {
  try {
    const existing = sessionStorage.getItem(THREAD_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    sessionStorage.setItem(THREAD_KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}

function loadMessages(): Message[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? (parsed as Message[]) : []
  } catch {
    return []
  }
}

function saveMessages(messages: ReadonlyArray<Message>) {
  try {
    if (messages.length === 0) sessionStorage.removeItem(STORAGE_KEY)
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-60)))
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
  pendingQuestion,
  children,
}: {
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

  const threadId = useRef(newThreadId()).current
  const chat = useChat({
    threadId,
    connection,
    tools,
    initialMessages: loadMessages() as never,
  })

  useEffect(() => saveMessages(chat.messages), [chat.messages])

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
      clear: chat.clear,
      send,
    }),
    [
      chat.messages,
      chat.isLoading,
      chat.stop,
      chat.error,
      chat.interrupts,
      chat.resolveInterrupts,
      chat.clear,
      send,
    ],
  )

  return <AssistantContext.Provider value={api}>{children}</AssistantContext.Provider>
}
