import type { DocumentLanguage } from '@fakturky/domain'
import { addDays, isoWeekday, isWeekend, todayPrague } from '@fakturky/domain/dates'
import { computeDocumentTotals, type VatTreatment } from '@fakturky/domain/vat'
import { Amount } from '@fakturky/ui/components/amount'
import { Button } from '@fakturky/ui/components/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@fakturky/ui/components/collapsible'
import { CurrencyCombobox } from '@fakturky/ui/components/currency-combobox'
import { DatePicker } from '@fakturky/ui/components/date-picker'
import { Input } from '@fakturky/ui/components/input'
import { Kbd } from '@fakturky/ui/components/kbd'
import { Label } from '@fakturky/ui/components/label'
import { Money } from '@fakturky/ui/components/money'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { PageHeader } from '@fakturky/ui/components/page-header'
import { Textarea } from '@fakturky/ui/components/textarea'
import { cn } from '@fakturky/ui/lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronDown, Loader2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { QuickAccountForm } from '@/components/bank/quick-account-form'
import { cs } from '@/i18n/cs'
import { formToSheet } from '@/lib/document-sheet'
import { apiErrorMessage } from '@/lib/errors'
import { num, trimDecimal, validNum } from '@/lib/invoice-numbers'
import { type InvoicePrefill, onInvoicePrefill, takeInvoicePrefill } from '@/lib/invoice-prefill'
import { client, orpc } from '@/lib/orpc'
import { CustomerCard, type PickedCustomer } from './invoice-editor/customer-card'
import { emptyLine, ItemsTable, type Line, nextLineKey } from './invoice-editor/items-table'
import { PreviewButton, PreviewPane, PreviewSheet, useIsWide } from './invoice-editor/preview'

const t = cs.invoices.form

function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="label-caps !font-sans mb-3">
      {children}
    </h2>
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
    <div className={cn('flex justify-between gap-6', muted && 'text-muted-foreground')}>
      <span>{label}</span>
      <Money amount={amount} currency={currency} />
    </div>
  )
}

const REGISTRY_DISMISS_KEY = 'registryNoteBannerDismissed'

export function InvoiceForm({ id }: { id?: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const defaults = useQuery(orpc.documents.defaults.queryOptions({ input: {} }))
  const accounts = useQuery(orpc.bankAccounts.list.queryOptions({ input: {} }))
  const profile = useQuery(orpc.businessProfile.get.queryOptions({ input: {} }))
  const look = useQuery(orpc.appearance.get.queryOptions({ input: {} }))
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
  const [rateTouched, setRateTouched] = useState(false)
  // The tax-point date the current rate belongs to; reopening a draft keeps its rate until the date changes.
  const [rateFor, setRateFor] = useState<string | null>(null)
  const rateRequest = useRef(0)
  const [roundTotal, setRoundTotal] = useState(false)
  const [bankAccountId, setBankAccountId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [introText, setIntroText] = useState('')
  const [footerText, setFooterText] = useState('')
  const [privateNote, setPrivateNote] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [language, setLanguage] = useState<DocumentLanguage>('cs')
  const [lines, setLines] = useState<Line[]>([emptyLine()])
  const [ready, setReady] = useState(false)
  const [dueTouched, setDueTouched] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [datesOpen, setDatesOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const wide = useIsWide()

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
            key: nextLineKey(),
            description: l.description,
            quantity: l.quantity || '1',
            unit: 'ks',
            unitPrice: l.unitPrice,
            // A VAT payer has no 0 % rate: unspecified/zero falls back to the base rate.
            vatRate:
              vatPayerDefault && (!l.vatRate || Number(l.vatRate) === 0)
                ? '21'
                : (l.vatRate ?? '0'),
            vatTreatment: 'standard',
            vatNote: '',
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
    setLanguage(d.language as DocumentLanguage)
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
    setRateTouched(false)
    setRateFor(d.exchangeRate ? (d.taxableDate ?? d.issueDate ?? today) : null)
    setRoundTotal(d.roundTotal)
    setBankAccountId(d.bankAccountId ?? '')
    setPaymentMethod(d.paymentMethod)
    setLanguage((d.language as DocumentLanguage) ?? 'cs')
    setOrderNumber(d.orderNumber ?? '')
    setIntroText(d.introText ?? '')
    setFooterText(d.footerText ?? '')
    setPrivateNote(d.privateNote ?? '')
    setMoreOpen(
      !!(d.introText || d.footerText || d.privateNote || d.orderNumber || d.language !== 'cs'),
    )
    setDueTouched(true)
    setTaxableTouched(true)
    setLines(
      d.lines.length
        ? d.lines.map((l) => ({
            key: nextLineKey(),
            description: l.description,
            quantity: trimDecimal(l.quantity),
            unit: l.unit ?? '',
            unitPrice: trimDecimal(l.unitPrice),
            vatRate: trimDecimal(l.vatRate),
            vatTreatment: (l.vatTreatment as VatTreatment) ?? 'standard',
            vatNote: l.vatNote ?? '',
          }))
        : [emptyLine()],
    )
    setReady(true)
  }, [existing.data, defaults.data, id, ready, today])

  // A credit note keeps the VAT treatment of the invoice it corrects, whatever the profile says now.
  // A proforma is not a tax document: it carries no VAT, the amount entered is what the customer pays.
  const isProforma = (existing.data?.type ?? docType) === 'proforma'
  const vatPayer =
    existing.data?.type === 'credit_note'
      ? existing.data.vatMode !== 'none'
      : !isProforma && (defaults.data?.vatPayer ?? false)
  const foreign = currency !== 'CZK'

  const currencyAccounts = (accounts.data ?? []).filter((a) => a.currency === currency)
  const effectiveAccount =
    bankAccountId && currencyAccounts.some((a) => a.id === bankAccountId)
      ? bankAccountId
      : (currencyAccounts.find((a) => a.defaultForCurrency)?.id ?? currencyAccounts[0]?.id ?? '')

  // The ČNB rate follows the tax point (DUZP; the issue date for non-payers) until the user edits it.
  const rateDate = vatPayer ? taxableDate : issueDate
  useEffect(() => {
    if (!ready || currency === 'CZK' || rateTouched || rateFor === rateDate) return
    void loadRate(currency, rateDate)
  }, [ready, currency, rateDate, rateTouched, rateFor])

  async function loadRate(cur = currency, date = rateDate) {
    if (cur === 'CZK' || cur.length !== 3) return
    const request = ++rateRequest.current
    try {
      const r = await client.lookup.exchangeRate({ currency: cur, date })
      // Ignore a late answer for an older request/date.
      if (request !== rateRequest.current) return
      setExchangeRate(r.rate)
      setRateFor(date)
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
          vatTreatment: l.vatTreatment,
        })),
        {
          vatPayer,
          roundTotal,
          currency,
          exchangeRate: foreign && validNum(exchangeRate) ? num(exchangeRate) : 1,
        },
      )
    } catch {
      return null
    }
  }, [lines, vatPayer, currency, exchangeRate, foreign, roundTotal])

  const customerRow = useQuery({
    ...orpc.contacts.get.queryOptions({ input: { id: customer?.id ?? '' } }),
    enabled: !!customer?.id,
  })
  const euReverseDomestic =
    vatPayer &&
    lines.some((l) => l.vatTreatment === 'eu_reverse_charge') &&
    customerRow.data?.country?.toUpperCase() === 'CZ'

  const payload = () => ({
    contactId: customer?.id ?? null,
    bankAccountId: effectiveAccount || null,
    issueDate,
    taxableDate,
    dueDate,
    currency,
    exchangeRate: foreign && exchangeRate ? num(exchangeRate) : null,
    roundTotal,
    paymentMethod,
    language,
    orderNumber: orderNumber.trim() || null,
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
        vatRate: vatPayer && l.vatTreatment === 'standard' ? num(l.vatRate) : '0',
        vatTreatment: vatPayer ? l.vatTreatment : ('standard' as const),
        vatNote: vatPayer && l.vatTreatment === 'exempt' ? l.vatNote.trim() || null : null,
      })),
  })

  // "Unsaved" = the payload differs from what was loaded or last saved. Seeded values that arrive late
  // (bank accounts, ČNB rate) are folded into the baseline instead of counting as edits.
  const current = JSON.stringify({ docType, ...payload() })
  const [baseline, setBaseline] = useState<string | null>(null)
  const settled = ready && accounts.isSuccess && (!foreign || rateFor !== null || rateTouched)
  useEffect(() => {
    if (settled && baseline === null) setBaseline(current)
  }, [settled])
  const dirty = baseline !== null && baseline !== current

  const [createdId, setCreatedId] = useState<string | undefined>()
  const [issueError, setIssueError] = useState<string | null>(null)
  // A refused issue on a brand-new invoice moves to the saved draft's URL; carry the message across.
  useEffect(() => {
    if (!id) return
    try {
      const kept = sessionStorage.getItem(`issueError:${id}`)
      if (kept) {
        setIssueError(kept)
        sessionStorage.removeItem(`issueError:${id}`)
      }
    } catch {
      /* storage unavailable */
    }
  }, [id])
  const draftId = id ?? createdId

  const save = useMutation({
    mutationFn: async (andIssue: boolean) => {
      setIssueError(null)
      const body = payload()
      if (andIssue && !customer) throw new Error(t.needCustomer)
      if (andIssue && body.lines.length === 0) throw new Error(t.needLines)
      const submitted = JSON.stringify({ docType, ...body })
      const doc = draftId
        ? await client.documents.updateDraft({ id: draftId, patch: body })
        : await client.documents.createDraft({ ...body, type: docType })
      setBaseline(submitted)
      if (!andIssue) return doc
      try {
        return await client.documents.issue({ id: doc.id })
      } catch (e) {
        // Keep the saved draft: a retry updates it instead of creating a second one.
        await queryClient.invalidateQueries({ queryKey: orpc.documents.key() })
        setCreatedId(doc.id)
        if (!id) {
          try {
            sessionStorage.setItem(`issueError:${doc.id}`, apiErrorMessage(e))
          } catch {
            /* storage unavailable */
          }
          navigate({ to: '/faktury/$id/upravit', params: { id: doc.id }, replace: true })
        }
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

  // Ctrl/⌘ + Enter issues from anywhere on the page. Without a bank account the first press asks
  // "pokračovat?" and the second one issues: an invoice with no QR is the costliest silent failure.
  const [confirmNoBank, setConfirmNoBank] = useState(false)
  const missingBank = accounts.isSuccess && !effectiveAccount
  const issueRef = useRef<() => void>(() => {})
  issueRef.current = () => {
    if (!ready || save.isPending) return
    if (missingBank && !confirmNoBank) {
      setConfirmNoBank(true)
      return
    }
    setConfirmNoBank(false)
    save.mutate(true)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.isComposing) {
        e.preventDefault()
        issueRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const weekend = dueDate && isWeekend(dueDate)
  const dueInDays = Math.round((Date.parse(dueDate) - Date.parse(issueDate)) / 86_400_000)

  function setIssue(v: string) {
    setIssueDate(v)
    // DUZP defaults to the issue date until the user sets it explicitly (docs/DOMAIN.md).
    if (!taxableTouched) setTaxableDate(v)
    if (!dueTouched && defaults.data) setDueDate(addDays(v, defaults.data.dueDays))
  }

  const rowTotals = lines.map((_, i) => totals?.lines[i]?.base)
  const type = (existing.data?.type ?? docType) as
    | 'invoice'
    | 'proforma'
    | 'credit_note'
    | 'payment_receipt'
  const account = currencyAccounts.find((a) => a.id === effectiveAccount)
  const sheetDoc = useMemo(
    () =>
      formToSheet(
        {
          type,
          issueDate,
          taxableDate,
          dueDate,
          vatPayer,
          currency,
          exchangeRate,
          roundTotal,
          language,
          paymentMethod,
          introText,
          footerText,
          lines,
          customerName: customer?.name ?? null,
        },
        { look: look.data, profile: profile.data, contact: customerRow.data, account },
      ),
    [
      type,
      issueDate,
      taxableDate,
      dueDate,
      vatPayer,
      currency,
      exchangeRate,
      roundTotal,
      language,
      paymentMethod,
      introText,
      footerText,
      lines,
      customer?.name,
      look.data,
      profile.data,
      customerRow.data,
      account,
    ],
  )

  const [registryDismissed, setRegistryDismissed] = useState(false)
  useEffect(() => {
    try {
      setRegistryDismissed(localStorage.getItem(REGISTRY_DISMISS_KEY) === '1')
    } catch {
      /* storage unavailable: the banner just stays */
    }
  }, [])
  function dismissRegistry() {
    setRegistryDismissed(true)
    try {
      localStorage.setItem(REGISTRY_DISMISS_KEY, '1')
    } catch {
      /* storage unavailable */
    }
  }

  const supplier = profile.data
  const supplierAddress = supplier?.address
  const totalValue = totals?.total ?? '0'

  return (
    <div className="mx-auto max-w-[1136px] pb-6">
      <PageHeader
        eyebrow={cs.invoices.type[type]}
        title={id ? t.titleEdit : t.titleNew}
        // A non-breaking space keeps the line, so the form does not jump when "unsaved" appears.
        subtitle={dirty ? t.unsaved : draftId ? t.savedState : '\u00a0'}
        className="mb-5"
      />
      {defaults.data && !defaults.data.hasProfile && (
        <p className="mb-4 rounded-lg border border-warning/50 bg-warning/14 p-3 text-foreground text-sm">
          {t.needProfile}{' '}
          <Link to="/nastaveni" className="underline">
            {cs.nav.settings}
          </Link>
        </p>
      )}

      {defaults.data?.hasProfile && defaults.data.registryNoteMissing && !registryDismissed && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/14 p-3 text-foreground text-sm max-sm:hidden">
          <p className="min-w-0 flex-1">
            {t.registryNoteMissing}{' '}
            <Link to="/nastaveni" className="underline">
              {cs.nav.settings}
            </Link>
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t.registryNoteDismiss}
            className="-my-1 -mr-1 shrink-0"
            onClick={dismissRegistry}
          >
            <X />
          </Button>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        <section
          className="sheet @container flex min-w-0 flex-col divide-y divide-border"
          aria-label={t.documentHeading}
        >
          {/* Header: what kind of document, and that the number comes at issue. */}
          <div className="space-y-3 p-5 max-sm:order-1 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              {id ? (
                <span className="font-serif text-xl">{cs.invoices.type[type]}</span>
              ) : (
                <NativeSelect
                  aria-label={t.documentType}
                  className="w-auto min-w-52 font-serif"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as 'invoice' | 'proforma')}
                >
                  <option value="invoice">{cs.invoices.type.invoice}</option>
                  <option value="proforma">{cs.invoices.type.proforma}</option>
                </NativeSelect>
              )}
              <p className="text-muted-foreground text-sm">
                {t.number}:{' '}
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{t.numberAuto}</span>
              </p>
            </div>
            {!id && docType === 'proforma' && (
              <p className="text-muted-foreground text-sm">{t.proformaHint}</p>
            )}
          </div>

          {/* Parties, side by side like on the invoice. */}
          <div className="grid gap-6 p-5 max-sm:order-2 sm:p-6 @[34rem]:grid-cols-2">
            <div>
              <SectionTitle>{t.supplier}</SectionTitle>
              {supplier ? (
                <div className="space-y-0.5 text-sm">
                  <div className="font-serif text-[17px] leading-6">{supplier.legalName}</div>
                  {supplierAddress?.street && (
                    <div className="text-muted-foreground max-sm:hidden">
                      {supplierAddress.street}
                    </div>
                  )}
                  {(supplierAddress?.zip || supplierAddress?.city) && (
                    <div className="text-muted-foreground max-sm:hidden">
                      {supplierAddress.zip} {supplierAddress.city}
                    </div>
                  )}
                  {(supplier.ico || supplier.dic) && (
                    <div className="pt-0.5 text-muted-foreground tabular-nums max-sm:hidden">
                      {supplier.ico && <>IČO {supplier.ico}</>}
                      {supplier.ico && supplier.dic && ' · '}
                      {supplier.dic && <>DIČ {supplier.dic}</>}
                    </div>
                  )}
                  <Link
                    to="/nastaveni"
                    className="inline-block pt-1.5 text-muted-foreground text-xs underline underline-offset-2 hover:text-foreground max-sm:hidden"
                  >
                    {t.supplierEdit}
                  </Link>
                </div>
              ) : (
                <div className="skel-shimmer h-16 rounded-lg" />
              )}
            </div>
            <div>
              <SectionTitle>{t.customer}</SectionTitle>
              <CustomerCard
                value={customer}
                details={customerRow.data}
                autoFocus={!id}
                onChange={(c) => {
                  setCustomer(c)
                  // Next thing to type is what you bill: land on the first description.
                  if (c)
                    setTimeout(
                      () => document.querySelector<HTMLElement>('[data-line-desc]')?.focus(),
                      0,
                    )
                }}
              />
              {euReverseDomestic && (
                <p role="alert" className="mt-3 text-destructive text-sm">
                  {cs.contacts.euReverseChargeDomestic}
                </p>
              )}
              {issueError && (
                <p role="alert" className="mt-3 text-destructive text-sm">
                  {issueError}{' '}
                  <Link to="/kontakty" className="underline">
                    {cs.nav.contacts}
                  </Link>
                </p>
              )}
            </div>
          </div>

          {/* Dates and currency. On a phone they sit after the items, folded into one summary row. */}
          <div className="p-5 max-sm:order-4 sm:p-6">
            <div className="max-sm:hidden">
              <SectionTitle>{t.dates}</SectionTitle>
            </div>
            <button
              type="button"
              aria-expanded={datesOpen}
              aria-controls="dates-fields"
              onClick={() => setDatesOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-3 text-left text-sm sm:hidden"
            >
              <span>
                {t.dueSummary(dueInDays, dueDate)}
                {foreign && ` · ${currency}`}
                <span className="text-muted-foreground">
                  {' '}
                  · {datesOpen ? t.datesHide : t.datesEdit}
                </span>
              </span>
              <ChevronDown
                aria-hidden
                className={cn(
                  'size-4 shrink-0 text-muted-foreground transition-transform',
                  datesOpen && 'rotate-180',
                )}
              />
            </button>
            <div
              id="dates-fields"
              className={cn(
                'grid gap-4 sm:grid-cols-2',
                datesOpen ? 'max-sm:mt-4' : 'max-sm:hidden',
              )}
            >
              <div className="space-y-1.5">
                <Label htmlFor="issueDate">{t.issueDate}</Label>
                <DatePicker id="issueDate" value={issueDate} onChange={setIssue} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dueDate">{t.dueDate}</Label>
                <DatePicker
                  id="dueDate"
                  value={dueDate}
                  presets
                  presetBase={issueDate}
                  onChange={(v) => {
                    setDueTouched(true)
                    setDueDate(v)
                  }}
                />
              </div>
              {vatPayer && (
                <div className="space-y-1.5">
                  <Label htmlFor="taxableDate">{t.taxableDate}</Label>
                  <DatePicker
                    id="taxableDate"
                    value={taxableDate}
                    onChange={(v) => {
                      setTaxableTouched(true)
                      setTaxableDate(v)
                    }}
                  />
                  <p className="text-muted-foreground text-xs">{t.taxableHint}</p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="currency">{t.currency}</Label>
                <CurrencyCombobox
                  id="currency"
                  value={currency}
                  onChange={(code) => {
                    setCurrency(code)
                    if (code !== 'CZK') {
                      setRateTouched(false)
                      setRateFor(null)
                    }
                  }}
                />
              </div>
              {foreign && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="rate">{t.exchangeRate}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="rate"
                      inputMode="decimal"
                      value={exchangeRate}
                      onChange={(e) => {
                        setRateTouched(true)
                        setExchangeRate(e.target.value)
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setRateTouched(false)
                        void loadRate(currency, rateDate)
                      }}
                    >
                      {t.exchangeRateLoad}
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">{t.exchangeRateHint}</p>
                </div>
              )}
            </div>
            {weekend && (
              <p
                className={cn('mt-3 text-muted-foreground text-sm', !datesOpen && 'max-sm:hidden')}
              >
                {t.weekendHint(t.weekdays[isoWeekday(dueDate) % 7] ?? '')}
              </p>
            )}
          </div>

          {/* Items and totals. */}
          <div className="p-5 max-sm:order-3 sm:p-6">
            <SectionTitle>{t.items}</SectionTitle>
            <ItemsTable
              lines={lines}
              onChange={setLines}
              vatPayer={vatPayer}
              rowTotals={rowTotals}
              currency={currency}
              newLine={() => emptyLine(vatPayer ? '21' : '0')}
            />

            {totals && (
              <div className="mt-5 ml-auto max-w-sm space-y-1 text-sm">
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
                {Number(totals.rounding) !== 0 && (
                  <Row label={t.rounding} amount={totals.rounding} currency={currency} muted />
                )}
                {vatPayer && foreign && validNum(exchangeRate) && Number(num(exchangeRate)) > 0 && (
                  <Row label={t.vatInCzk} amount={totals.vatTotalCzk} currency="CZK" muted />
                )}
                <div className="hairline mt-2 flex items-baseline justify-between gap-6 pt-3">
                  <span className="label-caps !font-sans">{t.total}</span>
                  <Amount value={totals.total} currency={currency} size="lg" />
                </div>
                {!vatPayer && (
                  <p className="text-muted-foreground text-xs">
                    {isProforma ? t.proformaNoVat : t.nonPayer}
                  </p>
                )}
              </div>
            )}
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={roundTotal}
                onChange={(e) => setRoundTotal(e.target.checked)}
              />
              {t.roundTotal}
            </label>
          </div>

          {/* Payment. */}
          <div className="p-5 max-sm:order-5 sm:p-6">
            <SectionTitle>{t.payment}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              {accounts.isSuccess && accounts.data.length === 0 ? (
                <div className="space-y-2 sm:col-span-2">
                  <p className="text-muted-foreground text-sm">{t.bankAddInline}</p>
                  <QuickAccountForm
                    onCreated={() =>
                      queryClient.invalidateQueries({ queryKey: orpc.bankAccounts.key() })
                    }
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="bank">{t.bankAccount}</Label>
                  <NativeSelect
                    id="bank"
                    value={effectiveAccount}
                    onChange={(e) => setBankAccountId(e.target.value)}
                  >
                    {currencyAccounts.length === 0 && <option value="">{t.bankAccountNone}</option>}
                    {currencyAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </NativeSelect>
                  {account && (
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {account.accountNumber
                        ? `${account.accountNumber}/${account.bankCode}`
                        : account.iban}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="method">{t.paymentMethod}</Label>
                <NativeSelect
                  id="method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {Object.entries(t.methods).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </div>

          {/* Texts, order number, language: out of the way until needed. */}
          <Collapsible open={moreOpen} onOpenChange={setMoreOpen} className="max-sm:order-6">
            <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 p-5 text-left outline-none focus-visible:bg-muted/50 sm:px-6">
              <span>
                <span className="block font-medium text-sm">{t.moreOptions}</span>
                <span className="block text-muted-foreground text-xs">{t.moreOptionsHint}</span>
              </span>
              <ChevronDown
                aria-hidden
                className="size-4 text-muted-foreground transition-transform group-aria-expanded:rotate-180"
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="space-y-1.5">
                <Label htmlFor="intro">{t.intro}</Label>
                <Textarea
                  id="intro"
                  rows={2}
                  value={introText}
                  onChange={(e) => setIntroText(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="footer">{t.footer}</Label>
                <Textarea
                  id="footer"
                  rows={2}
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="private">{t.privateNote}</Label>
                <Textarea
                  id="private"
                  rows={2}
                  value={privateNote}
                  onChange={(e) => setPrivateNote(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="order">{t.orderNumber}</Label>
                  <Input
                    id="order"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="language">{t.language}</Label>
                  <NativeSelect
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as DocumentLanguage)}
                  >
                    {Object.entries(t.languages).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>

        {wide && <PreviewPane doc={sheetDoc} />}
      </div>

      {/* Sticky action bar: the total, whether anything is unsaved, and the two ways out. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-6 border-t bg-background/90 px-4 py-3 backdrop-blur md:bottom-0 md:-mx-8 md:px-8">
        {confirmNoBank && missingBank && (
          <div
            role="alert"
            className="mx-auto mb-3 flex max-w-[1136px] flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-warning/50 bg-warning/14 px-3 py-2 text-sm"
          >
            <span className="min-w-0 flex-1">{t.noBankConfirm}</span>
            <span className="flex gap-2">
              <Button
                type="button"
                size="sm"
                autoFocus
                onClick={() => issueRef.current()}
                disabled={save.isPending}
              >
                {t.noBankConfirmYes}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setConfirmNoBank(false)}
              >
                {cs.common.cancel}
              </Button>
            </span>
          </div>
        )}
        <div className="mx-auto flex max-w-[1136px] items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="label-caps max-sm:sr-only">{t.totalShort}</div>
            <div className="flex items-baseline gap-3">
              <Amount
                value={totalValue}
                currency={currency}
                size="md"
                className="max-sm:text-lg [&>.opacity-60]:opacity-80"
              />
              <span
                className={cn(
                  'hidden items-center gap-1.5 text-xs sm:flex',
                  dirty ? 'text-warning' : 'text-muted-foreground',
                )}
                aria-live="polite"
              >
                {dirty && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
                {dirty ? t.unsaved : draftId ? t.savedState : ''}
              </span>
            </div>
          </div>
          <PreviewButton onClick={() => setPreviewOpen(true)} />
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending || !ready}
            onClick={() => save.mutate(false)}
          >
            {t.saveDraft}
          </Button>
          <Button
            type="button"
            title={t.issueHint}
            disabled={save.isPending || !ready}
            onClick={() => issueRef.current()}
          >
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            {t.issue}
            <Kbd
              aria-hidden
              className="ml-1 hidden border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground sm:inline-flex"
            >
              ⌘↵
            </Kbd>
          </Button>
        </div>
      </div>

      {!wide && <PreviewSheet doc={sheetDoc} open={previewOpen} onOpenChange={setPreviewOpen} />}
    </div>
  )
}
