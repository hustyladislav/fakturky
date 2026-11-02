import { addDays, isoWeekday, isWeekend, todayPrague } from '@fakturky/domain/dates'
import { computeDocumentTotals } from '@fakturky/domain/vat'
import { Button } from '@fakturky/ui/components/button'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { Money } from '@fakturky/ui/components/money'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { apiErrorMessage } from '@/lib/errors'
import { type InvoicePrefill, onInvoicePrefill, takeInvoicePrefill } from '@/lib/invoice-prefill'
import { client, orpc } from '@/lib/orpc'
import { CustomerPicker, type PickedCustomer } from './customer-picker'

const t = cs.invoices.form

type Line = {
  key: number
  description: string
  quantity: string
  unit: string
  unitPrice: string
  vatRate: string
}

const VAT_RATES = ['21', '12', '0']
let lineKey = 1
const emptyLine = (vatRate = '21'): Line => ({
  key: lineKey++,
  description: '',
  quantity: '1',
  unit: 'ks',
  unitPrice: '',
  vatRate,
})
/** Czech input: "1 500,5" (space or NBSP thousands, comma decimal) -> "1500.5". */
const num = (v: string) => {
  const t = v.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')
  return t === '' ? '0' : t
}
/** Strips trailing fraction zeros from a decimal string without going through floating point. */
const trimDecimal = (v: string) => (v.includes('.') ? v.replace(/\.?0+$/, '') : v)
const validNum = (v: string) => /^-?\d+(\.\d+)?$/.test(num(v))

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border p-4 sm:p-5">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export function InvoiceForm({ id }: { id?: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const defaults = useQuery(orpc.documents.defaults.queryOptions({ input: {} }))
  const accounts = useQuery(orpc.bankAccounts.list.queryOptions({ input: {} }))
  const existing = useQuery({
    ...orpc.documents.get.queryOptions({ input: { id: id ?? '' } }),
    enabled: !!id,
  })

  const today = todayPrague()
  const [docType, setDocType] = useState<'invoice' | 'proforma'>('invoice')
  const [customer, setCustomer] = useState<PickedCustomer | null>(null)
  const [issueDate, setIssueDate] = useState(today)
  const [dueDate, setDueDate] = useState(addDays(today, 14))
  const [taxableDate, setTaxableDate] = useState(today)
  const [taxableTouched, setTaxableTouched] = useState(false)
  const [currency, setCurrency] = useState('CZK')
  const [exchangeRate, setExchangeRate] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [introText, setIntroText] = useState('')
  const [footerText, setFooterText] = useState('')
  const [privateNote, setPrivateNote] = useState('')
  const [lines, setLines] = useState<Line[]>([emptyLine()])
  const [ready, setReady] = useState(false)
  const [dueTouched, setDueTouched] = useState(false)

  const vatPayerDefault = defaults.data?.vatPayer ?? false
  const applyPrefill = useCallback(
    (prefill: InvoicePrefill) => {
      if (prefill.dueDate) {
        setDueDate(prefill.dueDate)
        setDueTouched(true)
      }
      if (prefill.lines.length) {
        setLines(
          prefill.lines.map((l) => ({
            key: lineKey++,
            description: l.description,
            quantity: l.quantity || '1',
            unit: 'ks',
            unitPrice: l.unitPrice,
            vatRate: l.vatRate ?? (vatPayerDefault ? '21' : '0'),
          })),
        )
      }
      if (prefill.contactId) {
        client.contacts
          .get({ id: prefill.contactId })
          .then((c) => setCustomer({ id: c.id, name: c.name, ico: c.ico }))
          .catch(() => undefined)
      }
    },
    [vatPayerDefault],
  )
  // An assistant prefill that arrives while this form is already open (no remount happens).
  useEffect(() => {
    if (id || !ready) return
    return onInvoicePrefill(() => {
      const p = takeInvoicePrefill()
      if (p) applyPrefill(p)
    })
  }, [id, ready, applyPrefill])

  // Seed from defaults (new) or from the stored draft (edit), once.
  useEffect(() => {
    if (id || ready || !defaults.data) return
    const d = defaults.data
    setDueDate(addDays(today, d.dueDays))
    setCurrency(d.currency)
    setPaymentMethod(d.paymentMethod)
    setFooterText(d.footerText ?? '')
    setLines([emptyLine(d.vatPayer ? '21' : '0')])
    // Hand-off from the assistant (`prefillInvoiceForm`): applied once, on top of the defaults.
    const prefill = takeInvoicePrefill()
    if (prefill) applyPrefill(prefill)
    setReady(true)
  }, [defaults.data, ready, today, id, applyPrefill])
  useEffect(() => {
    const d = existing.data
    if (!id || !d || ready || !defaults.data) return
    setCustomer(d.contactId ? { id: d.contactId, name: d.customerName ?? '' } : null)
    setIssueDate(d.issueDate ?? today)
    setDueDate(d.dueDate ?? today)
    setTaxableDate(d.taxableDate ?? d.issueDate ?? today)
    setCurrency(d.currency)
    setExchangeRate(d.exchangeRate ? trimDecimal(d.exchangeRate) : '')
    setBankAccountId(d.bankAccountId ?? '')
    setPaymentMethod(d.paymentMethod)
    setIntroText(d.introText ?? '')
    setFooterText(d.footerText ?? '')
    setPrivateNote(d.privateNote ?? '')
    setDueTouched(true)
    setTaxableTouched(true)
    setLines(
      d.lines.length
        ? d.lines.map((l) => ({
            key: lineKey++,
            description: l.description,
            quantity: trimDecimal(l.quantity),
            unit: l.unit ?? '',
            unitPrice: trimDecimal(l.unitPrice),
            vatRate: trimDecimal(l.vatRate),
          }))
        : [emptyLine()],
    )
    setReady(true)
  }, [existing.data, defaults.data, id, ready, today])

  const vatPayer = defaults.data?.vatPayer ?? false
  const foreign = currency !== 'CZK'

  const currencyAccounts = (accounts.data ?? []).filter((a) => a.currency === currency)
  const effectiveAccount =
    bankAccountId && currencyAccounts.some((a) => a.id === bankAccountId)
      ? bankAccountId
      : (currencyAccounts.find((a) => a.defaultForCurrency)?.id ?? currencyAccounts[0]?.id ?? '')

  async function loadRate(cur = currency, date = taxableDate) {
    if (cur === 'CZK' || cur.length !== 3) return
    try {
      const r = await client.lookup.exchangeRate({ currency: cur, date })
      setExchangeRate(r.rate)
    } catch {
      /* the user can type the rate manually */
    }
  }

  const totals = useMemo(() => {
    try {
      return computeDocumentTotals(
        lines.map((l) => ({
          quantity: validNum(l.quantity) ? num(l.quantity) : '0',
          unitPrice: validNum(l.unitPrice) ? num(l.unitPrice) : '0',
          vatRate: validNum(l.vatRate) ? num(l.vatRate) : '0',
        })),
        {
          vatPayer,
          currency,
          exchangeRate: foreign && validNum(exchangeRate) ? num(exchangeRate) : 1,
        },
      )
    } catch {
      return null
    }
  }, [lines, vatPayer, currency, exchangeRate, foreign])

  const payload = () => ({
    contactId: customer?.id ?? null,
    bankAccountId: effectiveAccount || null,
    issueDate,
    taxableDate,
    dueDate,
    currency,
    exchangeRate: foreign && exchangeRate ? num(exchangeRate) : null,
    paymentMethod,
    introText: introText || null,
    footerText: footerText || null,
    privateNote: privateNote || null,
    lines: lines
      .filter((l) => l.description.trim())
      .map((l) => ({
        description: l.description,
        quantity: num(l.quantity),
        unit: l.unit || null,
        unitPrice: num(l.unitPrice),
        vatRate: vatPayer ? num(l.vatRate) : '0',
      })),
  })

  const [createdId, setCreatedId] = useState<string | undefined>()
  const [issueError, setIssueError] = useState<string | null>(null)
  const draftId = id ?? createdId

  const save = useMutation({
    mutationFn: async (andIssue: boolean) => {
      setIssueError(null)
      const body = payload()
      if (andIssue && !customer) throw new Error(t.needCustomer)
      if (andIssue && body.lines.length === 0) throw new Error(t.needLines)
      const doc = draftId
        ? await client.documents.updateDraft({ id: draftId, patch: body })
        : await client.documents.createDraft({ ...body, type: docType })
      if (!andIssue) return doc
      try {
        return await client.documents.issue({ id: doc.id })
      } catch (e) {
        // Keep the saved draft: a retry updates it instead of creating a second one.
        await queryClient.invalidateQueries({ queryKey: orpc.documents.key() })
        setCreatedId(doc.id)
        throw e
      }
    },
    onSuccess: async (doc, andIssue) => {
      await queryClient.invalidateQueries({ queryKey: orpc.documents.key() })
      toast.success(andIssue ? cs.invoices.detail.issued(doc.number ?? '') : t.saved)
      if (andIssue) navigate({ to: '/faktury/$id', params: { id: doc.id } })
      else if (!draftId) {
        setCreatedId(doc.id)
        navigate({ to: '/faktury/$id/upravit', params: { id: doc.id }, replace: true })
      }
    },
    onError: (e) => {
      const message = apiErrorMessage(e)
      setIssueError(message)
      toast.error(message)
    },
  })

  const weekend = dueDate && isWeekend(dueDate)
  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  function setIssue(v: string) {
    setIssueDate(v)
    // DUZP defaults to the issue date until the user sets it explicitly (docs/DOMAIN.md).
    if (!taxableTouched) setTaxableDate(v)
    if (!dueTouched && defaults.data) setDueDate(addDays(v, defaults.data.dueDays))
  }

  const grid = vatPayer
    ? 'grid-cols-[1fr_4.5rem_3.5rem_7rem_4.5rem_2rem]'
    : 'grid-cols-[1fr_4.5rem_3.5rem_7rem_2rem]'

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-28 sm:pb-6">
      <h1 className="text-2xl font-semibold">{id ? t.titleEdit : t.titleNew}</h1>
      {defaults.data && !defaults.data.hasProfile && (
        <p className="bg-warning/14 text-warning rounded-lg p-3 text-sm">
          {t.needProfile}{' '}
          <Link to="/nastaveni" className="underline">
            {cs.nav.settings}
          </Link>
        </p>
      )}

      {defaults.data?.hasProfile && defaults.data.registryNoteMissing && (
        <p className="bg-warning/14 text-warning rounded-lg p-3 text-sm">
          {t.registryNoteMissing}{' '}
          <Link to="/nastaveni" className="underline">
            {cs.nav.settings}
          </Link>
        </p>
      )}

      {!id && (
        <Card title={t.documentType}>
          <select
            aria-label={t.documentType}
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={docType}
            onChange={(e) => setDocType(e.target.value as 'invoice' | 'proforma')}
          >
            <option value="invoice">{cs.invoices.type.invoice}</option>
            <option value="proforma">{cs.invoices.type.proforma}</option>
          </select>
          {docType === 'proforma' && (
            <p className="text-muted-foreground text-sm">{t.proformaHint}</p>
          )}
        </Card>
      )}

      <Card title={t.customer}>
        <CustomerPicker value={customer} onChange={setCustomer} />
        {issueError && (
          <p role="alert" className="text-destructive text-sm">
            {issueError}{' '}
            <Link to="/kontakty" className="underline">
              {cs.nav.contacts}
            </Link>
          </p>
        )}
      </Card>

      <Card title={t.details}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="issueDate">{t.issueDate}</Label>
            <Input
              id="issueDate"
              type="date"
              value={issueDate}
              onChange={(e) => setIssue(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDate">{t.dueDate}</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueTouched(true)
                setDueDate(e.target.value)
              }}
            />
            <div className="flex flex-wrap gap-1">
              {[7, 14, 30].map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setDueTouched(true)
                    setDueDate(addDays(issueDate, d))
                  }}
                >
                  {t.dueIn(d)}
                </Button>
              ))}
            </div>
          </div>
          {vatPayer && (
            <div className="space-y-2">
              <Label htmlFor="taxableDate">{t.taxableDate}</Label>
              <Input
                id="taxableDate"
                type="date"
                value={taxableDate}
                onChange={(e) => {
                  setTaxableTouched(true)
                  setTaxableDate(e.target.value)
                }}
              />
              <p className="text-muted-foreground text-xs">{t.taxableHint}</p>
            </div>
          )}
        </div>
        {weekend && (
          <p className="text-muted-foreground text-sm">
            {t.weekendHint(t.weekdays[isoWeekday(dueDate) % 7] ?? '')}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="currency">{t.currency}</Label>
            <Input
              id="currency"
              list="currencies"
              value={currency}
              maxLength={3}
              onChange={(e) => {
                const v = e.target.value.toUpperCase()
                setCurrency(v)
                if (v.length === 3 && v !== 'CZK') void loadRate(v)
              }}
            />
            <datalist id="currencies">
              {['CZK', 'EUR', 'USD', 'GBP', 'PLN'].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          {foreign && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rate">{t.exchangeRate}</Label>
              <div className="flex gap-2">
                <Input
                  id="rate"
                  inputMode="decimal"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={() => loadRate()}>
                  {t.exchangeRateLoad}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">{t.exchangeRateHint}</p>
            </div>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          {t.number}: <span className="bg-muted rounded px-1.5 py-0.5 text-xs">{t.numberAuto}</span>
        </p>
      </Card>

      <Card title={t.items}>
        <div className="space-y-3">
          {lines.map((l) => (
            <div key={l.key} className="space-y-2 rounded-lg border p-3 sm:border-0 sm:p-0">
              <div className={`hidden gap-2 sm:grid ${grid}`}>
                <Input
                  aria-label={t.description}
                  placeholder={t.description}
                  value={l.description}
                  onChange={(e) => setLine(l.key, { description: e.target.value })}
                />
                <Input
                  aria-label={t.quantity}
                  inputMode="decimal"
                  value={l.quantity}
                  onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                />
                <Input
                  aria-label={t.unit}
                  value={l.unit}
                  onChange={(e) => setLine(l.key, { unit: e.target.value })}
                />
                <Input
                  aria-label={t.unitPrice}
                  placeholder={t.unitPrice}
                  inputMode="decimal"
                  value={l.unitPrice}
                  onChange={(e) => setLine(l.key, { unitPrice: e.target.value })}
                />
                {vatPayer && (
                  <VatSelect value={l.vatRate} onChange={(v) => setLine(l.key, { vatRate: v })} />
                )}
                <RemoveButton
                  disabled={lines.length === 1}
                  onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                />
              </div>
              {/* mobile: stacked */}
              <div className="space-y-2 sm:hidden">
                <Input
                  aria-label={t.description}
                  placeholder={t.description}
                  value={l.description}
                  onChange={(e) => setLine(l.key, { description: e.target.value })}
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    aria-label={t.quantity}
                    inputMode="decimal"
                    value={l.quantity}
                    onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                  />
                  <Input
                    aria-label={t.unit}
                    value={l.unit}
                    onChange={(e) => setLine(l.key, { unit: e.target.value })}
                  />
                  <Input
                    aria-label={t.unitPrice}
                    placeholder={t.unitPrice}
                    inputMode="decimal"
                    value={l.unitPrice}
                    onChange={(e) => setLine(l.key, { unitPrice: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  {vatPayer ? (
                    <VatSelect value={l.vatRate} onChange={(v) => setLine(l.key, { vatRate: v })} />
                  ) : (
                    <span />
                  )}
                  <RemoveButton
                    disabled={lines.length === 1}
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLines((ls) => [...ls, emptyLine(vatPayer ? '21' : '0')])}
        >
          <Plus /> {t.addLine}
        </Button>

        {totals && (
          <div className="ml-auto max-w-xs space-y-1 border-t pt-3 text-sm">
            {vatPayer && (
              <>
                <Row label={t.subtotal} amount={totals.subtotal} currency={currency} />
                {totals.recap.map((r) => (
                  <Row
                    key={`${r.vatTreatment}-${r.vatRate}`}
                    label={`${t.vat} · ${t.vatRecapRow(r.vatRate)}`}
                    amount={r.vat}
                    currency={currency}
                    muted
                  />
                ))}
              </>
            )}
            <div className="flex items-baseline justify-between pt-1 text-base font-semibold">
              <span>{t.total}</span>
              <Money amount={totals.total} currency={currency} />
            </div>
            {!vatPayer && <p className="text-muted-foreground text-xs">{t.nonPayer}</p>}
          </div>
        )}
      </Card>

      <Card title={t.payment}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bank">{t.bankAccount}</Label>
            <select
              id="bank"
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={effectiveAccount}
              onChange={(e) => setBankAccountId(e.target.value)}
            >
              {currencyAccounts.length === 0 && <option value="">{t.bankAccountNone}</option>}
              {currencyAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} · {a.accountNumber ? `${a.accountNumber}/${a.bankCode}` : a.iban}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="method">{t.paymentMethod}</Label>
            <select
              id="method"
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {Object.entries(t.methods).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card title={t.texts}>
        <div className="space-y-2">
          <Label htmlFor="intro">{t.intro}</Label>
          <textarea
            id="intro"
            rows={2}
            className="border-input bg-background w-full rounded-md border p-2 text-sm"
            value={introText}
            onChange={(e) => setIntroText(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="footer">{t.footer}</Label>
          <textarea
            id="footer"
            rows={2}
            className="border-input bg-background w-full rounded-md border p-2 text-sm"
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="private">{t.privateNote}</Label>
          <textarea
            id="private"
            rows={2}
            className="border-input bg-background w-full rounded-md border p-2 text-sm"
            value={privateNote}
            onChange={(e) => setPrivateNote(e.target.value)}
          />
        </div>
      </Card>

      <div className="from-background bg-gradient-to-t fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex gap-2 p-4 sm:static sm:justify-end sm:p-0">
        <Button
          type="button"
          variant="outline"
          className="flex-1 sm:flex-none"
          disabled={save.isPending}
          onClick={() => save.mutate(false)}
        >
          {t.saveDraft}
        </Button>
        <Button
          type="button"
          className="flex-[2] sm:flex-none"
          disabled={save.isPending}
          onClick={() => save.mutate(true)}
        >
          {t.issue}
        </Button>
      </div>
    </div>
  )
}

function Row({
  label,
  amount,
  currency,
  muted,
}: {
  label: string
  amount: string
  currency: string
  muted?: boolean
}) {
  return (
    <div className={`flex justify-between ${muted ? 'text-muted-foreground' : ''}`}>
      <span>{label}</span>
      <Money amount={amount} currency={currency} />
    </div>
  )
}

function VatSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      aria-label={t.vatRate}
      className="border-input bg-background h-9 rounded-md border px-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {VAT_RATES.map((r) => (
        <option key={r} value={r}>
          {r} %
        </option>
      ))}
    </select>
  )
}

function RemoveButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t.removeLine}
      disabled={disabled}
      onClick={onClick}
    >
      <Trash2 />
    </Button>
  )
}
