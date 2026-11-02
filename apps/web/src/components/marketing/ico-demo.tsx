import { isValidIco, normalizeIco } from '@fakturky/domain/ico'
import { InvoiceSheet } from '@fakturky/pdf/html'
import { Badge } from '@fakturky/ui/components/badge'
import { Button } from '@fakturky/ui/components/button'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Loader2, Search } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { cs } from '@/i18n/cs'
import { type AresSupplier, demoInvoiceFor } from './demo-invoice'

const t = cs.landing.demo

const EXAMPLES = ['27082440', '45274649']

type Failure = keyof typeof t.errors

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; supplier: AresSupplier }
  | { kind: 'error'; reason: Failure }

const STATUS_REASON: Record<number, Failure> = { 400: 'invalid', 404: 'notFound', 429: 'limited' }

/** Calls the public, rate-limited ARES proxy; never throws. */
async function lookup(ico: string, signal: AbortSignal): Promise<State> {
  try {
    const res = await fetch(`/api/public/ares/${ico}`, { signal })
    if (res.ok) return { kind: 'done', supplier: (await res.json()) as AresSupplier }
    return { kind: 'error', reason: STATUS_REASON[res.status] ?? 'upstream' }
  } catch {
    return { kind: 'error', reason: 'upstream' }
  }
}

/** "Zadejte IČO": the filled supplier card and a live QR invoice, from the real ARES data. */
export function IcoDemo() {
  const [value, setValue] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const abort = useRef<AbortController | null>(null)

  const run = (raw: string) => {
    const ico = normalizeIco(raw)
    abort.current?.abort()
    if (!isValidIco(ico)) {
      setState({ kind: 'error', reason: 'invalid' })
      return
    }
    const controller = new AbortController()
    abort.current = controller
    setState({ kind: 'loading' })
    void lookup(ico, controller.signal).then((next) => {
      if (!controller.signal.aborted) setState(next)
    })
  }
  useEffect(() => () => abort.current?.abort(), [])

  const onChange = (next: string) => {
    setValue(next)
    // A complete, valid number needs no button press.
    if (/^\d{8}$/.test(next.replace(/\s/g, '')) && isValidIco(next)) run(next)
    else if (state.kind === 'error') setState({ kind: 'idle' })
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    run(value)
  }

  const supplier = state.kind === 'done' ? state.supplier : null
  const doc = useMemo(() => demoInvoiceFor(supplier, t.placeholderName), [supplier])

  return (
    <section id="demo" className="mx-auto max-w-[1200px] px-5 py-12 md:px-8 md:py-16">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-14">
        <div>
          <h2 className="text-4xl leading-tight font-medium text-balance md:text-5xl">{t.title}</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-pretty text-muted-foreground">
            {t.text}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-3" noValidate>
            <Label htmlFor="demo-ico">{t.label}</Label>
            <div className="flex gap-2">
              <Input
                id="demo-ico"
                name="ico"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                maxLength={12}
                placeholder={t.placeholder}
                aria-invalid={state.kind === 'error' || undefined}
                aria-describedby="demo-status"
                className="h-11 text-base tabular-nums"
              />
              <Button type="submit" size="lg" className="h-11 shrink-0 px-4">
                {state.kind === 'loading' ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />
                ) : (
                  <Search data-icon="inline-start" aria-hidden />
                )}
                {t.submit}
              </Button>
            </div>
            <p id="demo-status" role="status" className="min-h-5 text-sm">
              {state.kind === 'loading' && (
                <span className="text-muted-foreground">{t.loading}</span>
              )}
              {state.kind === 'error' && (
                <span className="text-destructive">{t.errors[state.reason]}</span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {t.examples}
              {EXAMPLES.map((ico) => (
                <button
                  key={ico}
                  type="button"
                  onClick={() => {
                    setValue(ico)
                    run(ico)
                  }}
                  className="rounded-full border bg-card px-3 py-1 tabular-nums transition-colors hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {ico}
                </button>
              ))}
            </div>
          </form>

          {supplier && (
            <div
              className="sheet mt-6 space-y-1 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
              data-testid="demo-supplier"
            >
              <div className="label-caps">{t.supplier}</div>
              <div className="flex items-start justify-between gap-3">
                <div className="font-serif text-xl leading-7">{supplier.name}</div>
                <Badge variant="secondary" className="shrink-0">
                  {supplier.vatPayer ? t.vatPayer : t.nonPayer}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground tabular-nums">
                {cs.landing.demoFields(supplier.ico, supplier.dic)}
              </div>
              <div className="text-sm text-muted-foreground">
                {supplier.address.street}, {supplier.address.zip} {supplier.address.city}
              </div>
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">{t.source}</p>
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{t.invoiceTitle}</span>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link to="/registrace" />}
            >
              {t.cta}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
          <div className="mx-auto max-w-[34rem] overflow-hidden rounded-[3px] shadow-[0_0_0_1px_var(--border),0_4px_8px_rgb(0_0_0/0.05),0_30px_60px_-24px_rgb(0_0_0/0.3)]">
            <InvoiceSheet doc={doc} maxScale={1.4} headingLevel={3} decorative density="compact" />
          </div>
        </div>
      </div>
    </section>
  )
}
