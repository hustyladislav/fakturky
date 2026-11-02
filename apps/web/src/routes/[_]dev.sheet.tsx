import type { InvoiceSheetDraft, InvoiceSheetInput } from '@fakturky/pdf/html'
import { InvoiceSheet } from '@fakturky/pdf/html'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { useState } from 'react'

/**
 * Dev-only (`/_dev/sheet`): each PDF example next to the live HTML twin, for visual comparison.
 * `?w=595` sets the paper width in px, `?only=b` shows one fixture, `?mode=overlay|diff` stacks them.
 */

// Lazy and dev-only: in a production build the ternary is dead code, so the PNGs are not emitted.
const examplePngs: Record<string, () => Promise<string>> = import.meta.env.DEV
  ? import.meta.glob<string>('../../../../packages/pdf/examples/*.png', {
      query: '?url',
      import: 'default',
    })
  : {}

const GREEN_BLOCK =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='40'><rect width='120' height='40' fill='%231F4D3C'/></svg>"

interface Search {
  w?: number
  only?: string
  mode?: 'side' | 'overlay' | 'diff' | 'sheet'
  dark?: boolean
}

interface Loaded {
  fixtures: { id: string; doc: InvoiceSheetInput }[]
  pngs: Record<string, string>
  drafts: { id: string; title: string; doc: InvoiceSheetInput; density?: 'compact' }[]
}

export const Route = createFileRoute('/_dev/sheet')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(s.w ? { w: Number(s.w) } : {}),
    ...(typeof s.only === 'string' ? { only: s.only } : {}),
    ...(s.mode === 'overlay' || s.mode === 'diff' || s.mode === 'sheet' ? { mode: s.mode } : {}),
    ...(s.dark === true || s.dark === 'true' || s.dark === '1' ? { dark: true } : {}),
  }),
  loader: async (): Promise<Loaded> => {
    if (!import.meta.env.DEV) throw notFound()
    const { ALL, logoSignature } = await import('@fakturky/pdf/fixtures')
    const fixtures = Object.entries(ALL).map(([id, make]) => ({
      id,
      doc: make() as InvoiceSheetInput,
    }))
    fixtures.push({
      id: 'f-logo-signature',
      doc: { ...logoSignature(), logo: GREEN_BLOCK, signature: GREEN_BLOCK },
    })
    const draftEmpty: InvoiceSheetDraft = {
      type: 'invoice',
      language: 'cs',
      vatPayer: false,
      issueDate: '2026-11-02',
      supplier: {
        name: 'Jan Novák',
        ico: '04817623',
        street: 'Vinohradská 1234/56',
        city: 'Praha 2',
        zip: '120 00',
      },
      customer: {},
      lines: [],
      brandName: 'Fakturky',
    }
    const draftPartial: InvoiceSheetDraft = {
      ...draftEmpty,
      vatPayer: true,
      taxableDate: '2026-11-02',
      customer: { name: 'Studio Lípa s.r.o.', street: 'Na Příkopě 22' },
      lines: [
        { description: 'Konzultace', quantity: '3', unit: 'h', unitPrice: '1500' },
        { description: 'Rozpracovaná položka', quantity: '', unitPrice: 'abc' },
      ],
      payment: {
        method: 'bank_transfer',
        dueDate: '2026-11-16',
        variableSymbol: '2026099',
        bankAccount: {
          accountNumber: '19-2000145399',
          bankCode: '0800',
          iban: 'CZ6508000000192000145399',
        },
      },
    }
    const pngs: Record<string, string> = {}
    for (const [path, load] of Object.entries(examplePngs)) {
      pngs[path.split('/').pop()?.replace('.png', '') ?? path] = await load()
    }
    return {
      fixtures,
      pngs,
      drafts: [
        { id: 'draft-empty', title: 'Draft: nothing filled in', doc: draftEmpty },
        { id: 'draft-partial', title: 'Draft: partial data, no number', doc: draftPartial },
        {
          id: 'compact',
          title: 'density="compact" (b-platce)',
          doc: (fixtures[1] as { doc: InvoiceSheetInput }).doc,
          density: 'compact',
        },
      ],
    }
  },
  component: DevSheet,
})

function DevSheet() {
  const { fixtures, drafts, pngs } = Route.useLoaderData()
  const { w = 595, only, mode = 'side', dark } = Route.useSearch()
  const [opacity, setOpacity] = useState(0.5)
  const shown = only ? fixtures.filter((f) => f.id.startsWith(only)) : fixtures

  return (
    <div
      className={dark ? 'dark' : undefined}
      style={{
        background: dark ? '#121310' : '#e7e3d9',
        minHeight: '100vh',
        padding: 24,
        color: dark ? '#eee' : '#222',
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>InvoiceSheet vs PDF</h1>
      <p style={{ fontSize: 13, marginBottom: 16, opacity: 0.7 }}>
        Left: PDF render (packages/pdf/examples). Right: HTML twin at {w}px. Modes: ?mode=overlay,
        ?mode=diff. Opacity:{' '}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
        />
      </p>
      {shown.map((f) => {
        const png = pngs[f.id]
        const sheet = (
          <div style={{ width: w }} data-testid={`sheet-${f.id}`}>
            <InvoiceSheet doc={f.doc} maxScale={4} />
          </div>
        )
        return (
          <section key={f.id} style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{f.id}</h2>
            {mode === 'sheet' ? (
              sheet
            ) : mode === 'side' ? (
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                <div style={{ width: w, flex: 'none' }}>
                  {png ? (
                    <img
                      src={png}
                      alt={`PDF ${f.id}`}
                      style={{
                        width: '100%',
                        display: 'block',
                        boxShadow: '0 0 0 1px rgba(0,0,0,.1)',
                      }}
                    />
                  ) : (
                    'no png'
                  )}
                </div>
                {sheet}
              </div>
            ) : (
              <div style={{ position: 'relative', width: w }}>
                {sheet}
                {png ? (
                  <img
                    src={png}
                    alt={`PDF ${f.id}`}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      pointerEvents: 'none',
                      opacity: mode === 'diff' ? 1 : opacity,
                      mixBlendMode: mode === 'diff' ? 'difference' : 'normal',
                    }}
                  />
                ) : null}
              </div>
            )}
          </section>
        )
      })}
      {(mode === 'side' || mode === 'sheet') && !only ? (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '32px 0 12px' }}>
            Drafts and densities
          </h2>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {drafts.map((d) => (
              <div key={d.id} style={{ width: 420 }} data-testid={`sheet-${d.id}`}>
                <p style={{ fontSize: 12, marginBottom: 6 }}>{d.title}</p>
                <InvoiceSheet doc={d.doc} {...(d.density ? { density: d.density } : {})} />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
