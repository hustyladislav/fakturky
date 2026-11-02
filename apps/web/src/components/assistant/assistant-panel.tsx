import { BRAND } from '@fakturky/core/brand'
import { Bubble, BubbleContent } from '@fakturky/ui/components/bubble'
import { Button } from '@fakturky/ui/components/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@fakturky/ui/components/input-group'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@fakturky/ui/components/item'
import { Message, MessageContent } from '@fakturky/ui/components/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@fakturky/ui/components/message-scroller'
import { Trace, TraceIcon, TraceLine, TraceTitle } from '@fakturky/ui/components/trace'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import {
  ArrowUp,
  Check,
  Coffee,
  FileText,
  History,
  Loader2,
  MapPin,
  ShieldQuestion,
  Sparkles,
  Square,
  SquarePen,
  TriangleAlert,
  X,
} from 'lucide-react'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { cs } from '@/i18n/cs'
import { orpc } from '@/lib/orpc'
import { contextLabel, pageKey, starters } from './assistant-context'
import {
  type Part,
  recoveredFailures,
  resultDocumentId,
  type ToolPart,
  type TurnMessage,
  toolFailed,
} from './assistant-parts'
import { useAssistant } from './assistant-provider'
import { DOCUMENT_TOOLS, documentSummary } from './assistant-summary'
import { RichText } from './rich-text'

const t = cs.assistant

type Interrupt = {
  kind?: string
  toolCallId?: string
  resolveInterrupt?: (approved: boolean) => void
}

const toolLabel = (name: string) => (t.tools as Record<string, string>)[name] ?? name

/** The server sends stable codes; the copy is ours. Money-related limits get the "Kupte mi kávu" link. */
function limitState(error: Error | undefined) {
  if (!error) return null
  const code = String((error as { code?: unknown }).code ?? '')
  const message = (t.limits as Record<string, string>)[code]
  return { message: message ?? t.error, coffee: !!message && code !== 'assistant_limit_rate' }
}

function documentId(raw: string): string | null {
  try {
    const id = (JSON.parse(raw) as { id?: unknown }).id
    return typeof id === 'string' ? id : null
  } catch {
    return null
  }
}

/** What the action does in words (customer, lines, total) instead of the raw arguments. */
function ApprovalBody({ part }: { part: ToolPart }) {
  const id = DOCUMENT_TOOLS.has(part.name) ? documentId(part.arguments) : null
  const doc = useQuery({
    ...orpc.documents.get.queryOptions({ input: { id: id ?? '' } }),
    enabled: !!id,
  })
  const summary = doc.data ? documentSummary(part.name, doc.data) : null
  return (
    <>
      {summary ? (
        <>
          <ItemTitle>
            <ShieldQuestion className="size-4 shrink-0 text-primary" aria-hidden />
            {summary.title}
          </ItemTitle>
          <p className="text-sm text-muted-foreground tabular-nums">{summary.facts.join(' · ')}</p>
        </>
      ) : (
        <ItemTitle>
          <ShieldQuestion className="size-4 shrink-0 text-primary" aria-hidden />
          {toolLabel(part.name)}
        </ItemTitle>
      )}
      {!summary && !doc.isPending && (
        <details className="mt-1 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">{t.details}</summary>
          <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-muted p-2 text-[11px] leading-snug">
            {formatArgs(part.arguments)}
          </pre>
        </details>
      )}
    </>
  )
}

function ApprovalCard({ part, interrupt }: { part: ToolPart; interrupt: Interrupt | undefined }) {
  const decided = part.approval?.approved !== undefined
  const answered = decided || !interrupt
  const failed = toolFailed(part)
  const openId =
    part.name !== 'delete_document_draft'
      ? (resultDocumentId(part) ?? documentId(part.arguments))
      : null
  const done = part.output?.ok === true && openId && DOCUMENT_TOOLS.has(part.name)
  return (
    <Item variant="outline" size="sm" className="flex-col items-stretch bg-card">
      <ItemContent>
        <ApprovalBody part={part} />
        <ItemDescription className="line-clamp-none">
          {failed
            ? t.toolFailed
            : decided
              ? part.approval?.approved === false
                ? t.rejected
                : t.approved
              : answered
                ? t.expired
                : t.approvalHint}
        </ItemDescription>
      </ItemContent>
      {!answered && (
        <ItemActions>
          <Button size="sm" onClick={() => interrupt?.resolveInterrupt?.(true)}>
            <Check data-icon="inline-start" />
            {t.approve}
          </Button>
          <Button size="sm" variant="outline" onClick={() => interrupt?.resolveInterrupt?.(false)}>
            <X data-icon="inline-start" />
            {t.reject}
          </Button>
        </ItemActions>
      )}
      {done && openId && (
        <ItemActions>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link to="/faktury/$id" params={{ id: openId }} />}
          >
            <FileText data-icon="inline-start" />
            {t.openInvoice}
          </Button>
        </ItemActions>
      )}
    </Item>
  )
}

function formatArgs(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function ToolTrace({ part }: { part: ToolPart }) {
  const failed = toolFailed(part)
  const done = part.state === 'complete' || part.output !== undefined
  const status = failed ? 'error' : done ? undefined : 'running'
  return (
    <Trace>
      <TraceLine status={status}>
        <TraceIcon>
          {failed ? <TriangleAlert /> : done ? <Check /> : <Loader2 className="animate-spin" />}
        </TraceIcon>
        <TraceTitle>
          {failed ? `${toolLabel(part.name)} — ${t.toolFailed}` : toolLabel(part.name)}
        </TraceTitle>
      </TraceLine>
    </Trace>
  )
}

function AssistantMessage({
  parts,
  interrupts,
  hidden,
}: {
  parts: ReadonlyArray<Part>
  interrupts: Interrupt[]
  hidden: ReadonlySet<string>
}) {
  return (
    <Message>
      <MessageContent>
        {parts.map((part, i) => {
          if (part.type === 'tool-call' && hidden.has(part.id)) return null
          const key = `${part.type}-${'id' in part && part.id ? part.id : i}`
          if (part.type === 'text') {
            if (!part.content.trim()) return null
            return (
              <Bubble key={key} variant="ghost">
                <BubbleContent>
                  <RichText text={part.content.trim()} />
                </BubbleContent>
              </Bubble>
            )
          }
          if (part.type === 'tool-call') {
            if (part.state === 'approval-requested' || part.approval?.needsApproval) {
              return (
                <ApprovalCard
                  key={key}
                  part={part}
                  interrupt={interrupts.find((x) => x.toolCallId === part.id)}
                />
              )
            }
            return <ToolTrace key={key} part={part} />
          }
          return null
        })}
      </MessageContent>
    </Message>
  )
}

function Composer({ draft, setDraft }: { draft: string; setDraft: (v: string) => void }) {
  const { send, isLoading, stop } = useAssistant()
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => ref.current?.focus(), [])

  const submit = () => {
    const text = draft.trim()
    if (!text || isLoading) return
    setDraft('')
    void send(text)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    // Enter and ⌘/Ctrl+Enter send; Shift+Enter is a new line.
    if (!e.shiftKey || e.metaKey || e.ctrlKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <InputGroup className="bg-card has-disabled:bg-card has-disabled:opacity-100 dark:has-disabled:bg-input/30">
      <InputGroupTextarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t.placeholder}
        aria-label={t.placeholder}
        rows={1}
        maxLength={4000}
        className="max-h-44 min-h-12 resize-none field-sizing-content"
      />
      <InputGroupAddon align="block-end">
        {isLoading ? (
          <InputGroupButton
            size="icon-sm"
            variant="outline"
            className="ml-auto"
            aria-label={t.stop}
            onClick={stop}
          >
            <Square />
          </InputGroupButton>
        ) : (
          <InputGroupButton
            size="icon-sm"
            variant="default"
            className="ml-auto"
            aria-label={t.send}
            disabled={!draft.trim()}
            onClick={submit}
          >
            <ArrowUp />
          </InputGroupButton>
        )}
      </InputGroupAddon>
    </InputGroup>
  )
}

/** Where the user is, as a chip; the invoice number appears once the document has loaded. */
function ContextChip({ pathname }: { pathname: string }) {
  const key = pageKey(pathname)
  const id = key === 'invoice' ? pathname.split('/')[2] : undefined
  const doc = useQuery({
    ...orpc.documents.get.queryOptions({ input: { id: id ?? '' } }),
    enabled: !!id,
  })
  return (
    <span className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground">
      <MapPin className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{contextLabel(key, doc.data?.number)}</span>
    </span>
  )
}

function EmptyState({ setDraft }: { setDraft: (v: string) => void }) {
  const { send, history, openConversation, clearHistory } = useAssistant()
  const { pathname } = useLocation()
  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4">
      <div className="mt-auto space-y-3">
        <ContextChip pathname={pathname} />
        <p className="px-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>
      <div className="space-y-2">
        <p className="px-1 text-xs font-medium text-muted-foreground">{t.suggestionsTitle}</p>
        <div className="flex flex-wrap gap-2">
          {starters(pageKey(pathname)).map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full border bg-card px-3 py-1.5 text-left text-sm transition-colors hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              onClick={() => (s.endsWith(' ') ? setDraft(s) : void send(s))}
            >
              {s.trim()}
              {s.endsWith(' ') ? '…' : ''}
            </button>
          ))}
        </div>
      </div>
      {history.length > 0 && (
        <section className="space-y-1" aria-label={t.recent}>
          <div className="flex items-center justify-between px-1">
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <History className="size-3" aria-hidden />
              {t.recent}
            </h3>
            <button
              type="button"
              onClick={clearHistory}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {t.clearHistory}
            </button>
          </div>
          <ul>
            {history.slice(0, 5).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => openConversation(c.id)}
                  className="flex w-full items-baseline justify-between gap-3 rounded-md px-1 py-1.5 text-left text-sm transition-colors hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="truncate">{c.title}</span>
                  <RelativeTime at={c.updatedAt} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="px-1 text-xs leading-relaxed text-muted-foreground">{t.privacy}</p>
    </div>
  )
}

function RelativeTime({ at }: { at: number }) {
  const days = Math.round((at - Date.now()) / 86_400_000)
  const rtf = new Intl.RelativeTimeFormat('cs', { numeric: 'auto' })
  return <span className="shrink-0 text-xs text-muted-foreground">{rtf.format(days, 'day')}</span>
}

export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const { messages, isLoading, error, interrupts, clear } = useAssistant()
  const [draft, setDraft] = useState('')
  const limit = limitState(error)
  const pending = interrupts as unknown as Interrupt[]
  const last = messages[messages.length - 1]
  const recovered = recoveredFailures(messages as unknown as TurnMessage[])
  const waiting = isLoading && (!last || last.role === 'user')

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-muted sm:w-[380px]"
      aria-label={cs.shell.assistant}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-primary" aria-hidden />
          {t.title}
        </span>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t.newChat}
              title={t.newChat}
              onClick={clear}
            >
              <SquarePen />
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label={cs.common.close} onClick={onClose}>
            <X />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {messages.length === 0 ? (
          <EmptyState setDraft={setDraft} />
        ) : (
          <MessageScrollerProvider>
            <MessageScroller>
              <MessageScrollerViewport>
                <MessageScrollerContent className="gap-4 p-4">
                  {messages.map((m, index) => {
                    if (m.role === 'user') {
                      const text = m.parts.map((p) => (p.type === 'text' ? p.content : '')).join('')
                      return (
                        <MessageScrollerItem
                          key={m.id}
                          scrollAnchor={index === messages.length - 1}
                        >
                          <Message align="end">
                            <MessageContent>
                              <Bubble align="end">
                                <BubbleContent className="whitespace-pre-wrap">
                                  {text}
                                </BubbleContent>
                              </Bubble>
                            </MessageContent>
                          </Message>
                        </MessageScrollerItem>
                      )
                    }
                    if (m.role !== 'assistant') return null
                    return (
                      <MessageScrollerItem key={m.id} scrollAnchor={index === messages.length - 1}>
                        <AssistantMessage
                          parts={m.parts as unknown as Part[]}
                          interrupts={pending}
                          hidden={recovered}
                        />
                      </MessageScrollerItem>
                    )
                  })}
                  {waiting && (
                    <MessageScrollerItem>
                      <Trace>
                        <TraceLine status="running">
                          <TraceIcon>
                            <Loader2 className="animate-spin" />
                          </TraceIcon>
                          <TraceTitle>{t.thinking}</TraceTitle>
                        </TraceLine>
                      </Trace>
                    </MessageScrollerItem>
                  )}
                  {limit && (
                    <MessageScrollerItem>
                      <Item
                        variant="outline"
                        size="sm"
                        className="border-destructive/30 bg-card"
                        role="alert"
                      >
                        <ItemContent>
                          <ItemDescription className="line-clamp-none text-foreground">
                            {limit.message}
                          </ItemDescription>
                        </ItemContent>
                        {limit.coffee && (
                          <ItemActions>
                            <Button
                              size="sm"
                              variant="outline"
                              nativeButton={false}
                              render={
                                <a href={BRAND.supportUrl} target="_blank" rel="noreferrer" />
                              }
                            >
                              <Coffee data-icon="inline-start" />
                              {t.coffee}
                            </Button>
                          </ItemActions>
                        )}
                      </Item>
                    </MessageScrollerItem>
                  )}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
        )}
      </div>

      <div className="shrink-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Composer draft={draft} setDraft={setDraft} />
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">{t.composerHint}</p>
      </div>
    </aside>
  )
}
