import { BRAND } from '@fakturky/core/brand'
import { Logo } from '@fakturky/ui/components/logo'
import { ThemeToggle } from '@fakturky/ui/components/theme'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowUpRight, Check, Copy } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { cs } from '@/i18n/cs'

export const Route = createFileRoute('/docs/mcp')({
  head: () => ({ meta: [{ title: `${cs.docsMcp.title} – ${BRAND.name}` }] }),
  component: DocsMcp,
})

/** Terminal-style block (always dark, like the PDF's ink on paper is always light) with a copy button. */
function Code({ children, label }: { children: string; label?: string }) {
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <div className="group relative overflow-hidden rounded-xl bg-[#1b1c17] text-[#ece6d6] shadow-[0_0_0_1px_rgb(0_0_0/0.25)]">
      {label && (
        <div className="flex h-9 items-center border-b border-white/10 px-4 text-[11px] font-semibold tracking-[0.08em] text-[#a9a391] uppercase">
          {label}
        </div>
      )}
      <pre className="overflow-x-auto p-4 pr-14 font-mono text-[13px] leading-6">{children}</pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard
            ?.writeText(children)
            .then(() => {
              setDone(true)
              clearTimeout(timer.current)
              timer.current = setTimeout(() => setDone(false), 1600)
            })
            .catch(() => {})
        }}
        className="absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-md text-[#a9a391] transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
        aria-label={done ? cs.docsMcp.copied : cs.docsMcp.copy}
        title={done ? cs.docsMcp.copied : cs.docsMcp.copy}
      >
        {done ? <Check className="size-4 text-[#8cc4a4]" /> : <Copy className="size-4" />}
      </button>
    </div>
  )
}

function Step({
  id,
  n,
  title,
  children,
}: {
  id: string
  n: number
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="sheet scroll-mt-8 space-y-3 p-5 sm:p-6">
      <h2 className="flex items-center gap-3 font-serif text-xl leading-7 font-medium">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-sans text-xs font-semibold text-primary tabular-nums">
          {n}
        </span>
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground sm:pl-10">
        {children}
      </div>
    </section>
  )
}

function DocsMcp() {
  const [origin, setOrigin] = useState('https://fakturky.vercel.app')
  useEffect(() => setOrigin(window.location.origin), [])
  const url = `${origin}/mcp`
  const d = cs.docsMcp

  const cursorConfig = JSON.stringify(
    { mcpServers: { [BRAND.slug]: { url, headers: { Authorization: 'Bearer fk_…' } } } },
    null,
    2,
  )
  const toc = [
    ['url', d.urlLabel],
    ['auth', d.authTitle],
    ['claude', d.claudeTitle],
    ['claude-code', d.claudeCodeTitle],
    ['chatgpt', d.chatgptTitle],
    ['cursor', d.cursorTitle],
    ['tools', d.toolsTitle],
  ] as const

  return (
    <div className="min-h-svh">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link to="/">
          <Logo name={BRAND.name} markClassName="size-8" />
        </Link>
        <div className="flex items-center gap-5 text-sm">
          <a href="/docs/api" className="text-muted-foreground hover:text-foreground">
            REST API
          </a>
          <ThemeToggle labels={cs.theme} />
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-x-12 px-6 pt-10 pb-24 lg:grid-cols-[13rem_minmax(0,42rem)]">
        <aside className="hidden lg:block">
          <nav aria-label={d.title} className="sticky top-8">
            <p className="label-caps mb-3">{d.contents}</p>
            <ol className="space-y-0.5 border-l text-sm">
              {toc.map(([id, label]) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="-ml-px block border-l border-transparent py-1 pl-3 leading-5 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <main className="space-y-5">
          <header className="mb-6 space-y-3">
            <p className="label-caps">{d.eyebrow}</p>
            <h1 className="font-serif text-[44px] leading-[1.08] font-medium tracking-[-0.02em] text-balance">
              {d.title}
            </h1>
            <p className="text-[17px] leading-relaxed text-muted-foreground">{d.intro}</p>
          </header>

          <section id="url" className="scroll-mt-8 space-y-2">
            <h2 className="label-caps font-sans text-foreground">{d.urlLabel}</h2>
            <Code>{url}</Code>
          </section>

          <Step id="auth" n={1} title={d.authTitle}>
            <p>{d.authBody}</p>
          </Step>
          <Step id="claude" n={2} title={d.claudeTitle}>
            <p>{d.claudeBody}</p>
          </Step>
          <Step id="claude-code" n={3} title={d.claudeCodeTitle}>
            <Code label="Terminal">{`claude mcp add --transport http ${BRAND.slug} ${url}`}</Code>
          </Step>
          <Step id="chatgpt" n={4} title={d.chatgptTitle}>
            <p>{d.chatgptBody}</p>
          </Step>
          <Step id="cursor" n={5} title={d.cursorTitle}>
            <Code label="mcp.json">{cursorConfig}</Code>
          </Step>
          <Step id="tools" n={6} title={d.toolsTitle}>
            <p>{d.toolsBody}</p>
          </Step>

          <footer className="flex flex-wrap gap-x-6 gap-y-2 pt-4 text-sm">
            <a
              href="/docs/api"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {d.apiLink} <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
            <a
              href="/nastaveni#api"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {d.keysLink} <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          </footer>
        </main>
      </div>
    </div>
  )
}
