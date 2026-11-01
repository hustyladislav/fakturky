import { BRAND } from '@fakturky/core/brand'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { cs } from '@/i18n/cs'

export const Route = createFileRoute('/docs/mcp')({
  head: () => ({ meta: [{ title: `${cs.docsMcp.title} – ${BRAND.name}` }] }),
  component: DocsMcp,
})

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border bg-muted p-3 font-mono text-sm">
      {children}
    </pre>
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

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold">{d.title}</h1>
        <p className="text-muted-foreground">{d.intro}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{d.urlLabel}</h2>
        <Code>{url}</Code>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{d.authTitle}</h2>
        <p className="text-muted-foreground">{d.authBody}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{d.claudeTitle}</h2>
        <p className="text-muted-foreground">{d.claudeBody}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{d.claudeCodeTitle}</h2>
        <Code>{`claude mcp add --transport http ${BRAND.slug} ${url}`}</Code>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{d.chatgptTitle}</h2>
        <p className="text-muted-foreground">{d.chatgptBody}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{d.cursorTitle}</h2>
        <Code>{cursorConfig}</Code>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{d.toolsTitle}</h2>
        <p className="text-muted-foreground">{d.toolsBody}</p>
      </section>

      <footer className="flex gap-4 text-sm underline">
        <a href="/docs/api">{d.apiLink}</a>
        <a href="/nastaveni">{d.keysLink}</a>
      </footer>
    </main>
  )
}
