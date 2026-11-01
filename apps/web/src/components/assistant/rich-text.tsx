import { Fragment, type ReactNode } from 'react'

/** Splits `**bold**` and `` `code` `` out of a line. Everything else stays plain text (never HTML). */
export function inlineParts(line: string): { kind: 'text' | 'bold' | 'code'; text: string }[] {
  const parts: { kind: 'text' | 'bold' | 'code'; text: string }[] = []
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g
  let last = 0
  for (const m of line.matchAll(re)) {
    if (m.index > last) parts.push({ kind: 'text', text: line.slice(last, m.index) })
    if (m[1] !== undefined) parts.push({ kind: 'bold', text: m[1] })
    else parts.push({ kind: 'code', text: m[2] ?? '' })
    last = m.index + m[0].length
  }
  if (last < line.length) parts.push({ kind: 'text', text: line.slice(last) })
  return parts
}

function Inline({ line }: { line: string }) {
  return inlineParts(line).map((p, i) => {
    const key = `${i}-${p.kind}`
    if (p.kind === 'bold') return <strong key={key}>{p.text}</strong>
    if (p.kind === 'code')
      return (
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {p.text}
        </code>
      )
    return <Fragment key={key}>{p.text}</Fragment>
  })
}

/** The few Markdown constructs the model uses (bold, code, bullet lists, paragraphs) — no HTML injection. */
export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (!bullets.length) return
    const items = bullets
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-0.5 pl-5">
        {items.map((b, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static, never reordered
          <li key={i}>
            <Inline line={b} />
          </li>
        ))}
      </ul>,
    )
    bullets = []
  }
  for (const raw of text.split('\n')) {
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(raw)
    if (bullet) {
      bullets.push(bullet[1] ?? '')
      continue
    }
    flush()
    if (raw.trim()) {
      blocks.push(
        <p key={`p-${blocks.length}`}>
          <Inline line={raw.trim()} />
        </p>,
      )
    }
  }
  flush()
  return <div className="space-y-2">{blocks}</div>
}
