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
import {
  ArrowUp,
  Check,
  Coffee,
  Loader2,
  ShieldQuestion,
  Sparkles,
  Square,
  SquarePen,
  TriangleAlert,
  X,
} from 'lucide-react'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { cs } from '@/i18n/cs'
import { useAssistant } from './assistant-provider'
import { RichText } from './rich-text'

const t = cs.assistant

type ToolPart = {
  type: 'tool-call'
  id: string
  name: string
  arguments: string
  state: string
  output?: { ok?: boolean }
  approval?: { id: string; needsApproval: boolean; approved?: boolean }
}
type Part = { type: 'text'; content: string } | ToolPart
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

function ApprovalCard({ part, interrupt }: { part: ToolPart; interrupt: Interrupt | undefined }) {
  const decided = part.approval?.approved !== undefined
  const answered = decided || !interrupt
  return (
    <Item variant="outline" size="sm" className="bg-card">
      <ItemContent>
        <ItemTitle>
          <ShieldQuestion className="size-4 text-primary" aria-hidden />
          {toolLabel(part.name)}
        </ItemTitle>
        <ItemDescription className="line-clamp-none">
          {answered
            ? part.approval?.approved === false
              ? t.rejected
              : t.approved
            : t.approvalHint}
        </ItemDescription>
        <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-muted p-2 text-[11px] leading-snug text-muted-foreground">
          {formatArgs(part.arguments)}
        </pre>
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
  const failed = part.state === 'error' || part.output?.ok === false
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
}: {
  parts: ReadonlyArray<Part>
  interrupts: Interrupt[]
}) {
  return (
    <Message>
      <MessageContent>
        {parts.map((part, i) => {
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
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <InputGroup className="bg-card">
      <InputGroupTextarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t.placeholder}
        aria-label={t.placeholder}
        rows={2}
        maxLength={4000}
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

export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const { messages, isLoading, error, interrupts, clear, send } = useAssistant()
  const [draft, setDraft] = useState('')
  const limit = limitState(error)
  const pending = interrupts as unknown as Interrupt[]
  const last = messages[messages.length - 1]
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
          <div className="flex h-full flex-col justify-end gap-4 p-4">
            <div className="space-y-1 px-1">
              <p className="text-sm text-muted-foreground">{t.subtitle}</p>
            </div>
            <div className="space-y-2">
              <p className="px-1 text-xs font-medium text-muted-foreground">{t.suggestionsTitle}</p>
              <div className="flex flex-wrap gap-2">
                {t.suggestions.map((s) => (
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
          </div>
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
      </div>
    </aside>
  )
}
