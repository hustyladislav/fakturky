import { Fragment, type ReactNode } from 'react'

type Part =
  | { kind: 'text' | 'bold' | 'code'; text: string }
  | { kind: 'link'; text: string; href: string }

/** Internal paths and http(s) only; anything else (javascript:, data:) stays plain text. */
export function safeHref(href: string): string | null {
  if (href.startsWith('/') && !href.startsWith('//')) return href
  try {
    const url = new URL(href)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

/** Splits `**bold**`, `` `code` `` and `[text](url)` out of a line. Everything else stays plain text (never HTML). */
export function inlineParts(line: string): Part[] {
  const parts: Part[] = []
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  for (const m of line.matchAll(re)) {
    if (m.index > last) parts.push({ kind: 'text', text: line.slice(last, m.index) })
    if (m[1] !== undefined) parts.push({ kind: 'bold', text: m[1] })
    else if (m[2] !== undefined) parts.push({ kind: 'code', text: m[2] })
    else {
      const href = safeHref(m[4] ?? '')
      if (href) parts.push({ kind: 'link', text: m[3] ?? '', href })
      else parts.push({ kind: 'text', text: m[0] })
    }
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
    if (p.kind === 'link')
      return (
        <a
          key={key}
          href={p.href}
          className="text-primary underline underline-offset-2"
          {...(p.href.startsWith('/') ? {} : { target: '_blank', rel: 'noreferrer' })}
        >
          {p.text}
        </a>
      )
    return <Fragment key={key}>{p.text}</Fragment>
  })
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())

const isSeparator = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)

/** Markdown the model uses: bold, code, links, bullet/numbered lists, headings, pipe tables, paragraphs. No HTML. */
export function RichText({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const raw = lines[i] ?? ''
    const key = `b-${blocks.length}`

    const bullet = /^\s*[-*•]\s+/.test(raw)
    const numbered = /^\s*\d+[.)]\s+/.test(raw)
    if (bullet || numbered) {
      const items: string[] = []
      const re = bullet ? /^\s*[-*•]\s+(.*)$/ : /^\s*\d+[.)]\s+(.*)$/
      while (i < lines.length) {
        const m = re.exec(lines[i] ?? '')
        if (!m) break
        items.push(m[1] ?? '')
        i++
      }
      const Tag = numbered ? 'ol' : 'ul'
      blocks.push(
        <Tag key={key} className={`space-y-0.5 pl-5 ${numbered ? 'list-decimal' : 'list-disc'}`}>
          {items.map((item, n) => (
            <li key={`${n}-${item}`}>
              <Inline line={item} />
            </li>
          ))}
        </Tag>,
      )
      continue
    }

    if (raw.includes('|') && isSeparator(lines[i + 1] ?? '')) {
      const head = splitRow(raw)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && (lines[i] ?? '').includes('|')) {
        rows.push(splitRow(lines[i] ?? ''))
        i++
      }
      blocks.push(
        <div key={key} className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                {head.map((h) => (
                  <th key={h} className="px-2.5 py-1.5 font-medium">
                    <Inline line={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, n) => (
                <tr key={`${n}-${r.join('|')}`} className="border-t">
                  {r.map((c, m) => (
                    <td key={`${m}-${c}`} className="px-2.5 py-1.5 tabular-nums">
                      <Inline line={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    const heading = /^#{1,4}\s+(.*)$/.exec(raw)
    if (heading) {
      blocks.push(
        <p key={key} className="text-base">
          <Inline line={heading[1] ?? ''} />
        </p>,
      )
    } else if (raw.trim()) {
      blocks.push(
        <p key={key}>
          <Inline line={raw.trim()} />
        </p>,
      )
    }
    i++
  }
  return <div className="space-y-2">{blocks}</div>
}
