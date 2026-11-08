import type { DocumentLanguage } from '@fakturky/domain'
import { addDays, todayPrague } from '@fakturky/domain/dates'
import { computeDocumentTotals } from '@fakturky/domain/vat'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { formToSheet } from '@/lib/document-sheet'
import { apiErrorMessage } from '@/lib/errors'
import { num, validNum } from '@/lib/invoice-numbers'
import { type InvoicePrefill, onInvoicePrefill, takeInvoicePrefill } from '@/lib/invoice-prefill'
import { client, orpc } from '@/lib/orpc'
import { type DraftFields, emptyFields, fieldsFromDocument, prefillLines } from './draft'
import { emptyLine } from './items-table'

const t = cs.invoices.form

/**
 * The invoice editor's whole state and its two exits (save draft, issue). Seeding (defaults for a new
 * invoice, the stored draft when editing, an assistant prefill) and the derived totals live here; the
 * sections only read `fields`, call `set` and render.
 */
export function useInvoiceDraft(id?: string) {
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
  const [fields, setFields] = useState<DraftFields>(() => emptyFields(today, addDays(today, 14)))
  const set = useCallback(
    (patch: Partial<DraftFields>) => setFields((f) => ({ ...f, ...patch })),
    [],
  )
  const [ready, setReady] = useState(false)
  // Dates follow the issue date until the user sets them explicitly (docs/DOMAIN.md).
  const dueTouched = useRef(false)
  const taxableTouched = useRef(false)
  const [rateTouched, setRateTouched] = useState(false)
  // The tax-point date the current rate belongs to; reopening a draft keeps its rate until the date changes.
  const [rateFor, setRateFor] = useState<string | null>(null)
  const rateRequest = useRef(0)

  const vatPayerDefault = defaults.data?.vatPayer ?? false
  const applyPrefill = useCallback(
    (prefill: InvoicePrefill) => {
      const patch: Partial<DraftFields> = {}
      if (prefill.dueDate) {
        patch.dueDate = prefill.dueDate
        dueTouched.current = true
      }
      if (prefill.lines.length) patch.lines = prefillLines(prefill, vatPayerDefault)
      set(patch)
      if (prefill.contactId) {
        client.contacts
          .get({ id: prefill.contactId })
          .then((c) => set({ customer: { id: c.id, name: c.name, ico: c.ico } }))
          .catch(() => undefined)
      }
    },
    [vatPayerDefault, set],
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
    setFields((f) => ({
      ...f,
      dueDate: addDays(today, d.dueDays),
      currency: d.currency,
      paymentMethod: d.paymentMethod,
      language: d.language as DocumentLanguage,
      footerText: d.footerText ?? '',
      // Keep the row's key: replacing it remounts the input the user may already be typing in.
      lines: f.lines.map((l) => ({ ...l, vatRate: d.vatPayer ? '21' : '0' })),
    }))
    // Hand-off from the assistant (`prefillInvoiceForm`): applied once, on top of the defaults.
    const prefill = takeInvoicePrefill()
    if (prefill) applyPrefill(prefill)
    setReady(true)
  }, [defaults.data, ready, today, id, applyPrefill])
  useEffect(() => {
    const d = existing.data
    if (!id || !d || ready || !defaults.data) return
    const stored = fieldsFromDocument(d, today)
    setFields((f) => ({ ...f, ...stored }))
    setRateTouched(false)
    setRateFor(d.exchangeRate ? stored.taxableDate : null)
    dueTouched.current = true
    taxableTouched.current = true
    setReady(true)
  }, [existing.data, defaults.data, id, ready, today])

  const { currency, issueDate, taxableDate, lines, roundTotal, exchangeRate } = fields
  // A credit note keeps the VAT treatment of the invoice it corrects, whatever the profile says now.
  // A proforma is not a tax document: it carries no VAT, the amount entered is what the customer pays.
  const isProforma = (existing.data?.type ?? fields.docType) === 'proforma'
  const vatPayer =
    existing.data?.type === 'credit_note'
      ? existing.data.vatMode !== 'none'
      : !isProforma && (defaults.data?.vatPayer ?? false)
  const foreign = currency !== 'CZK'
  const type = (existing.data?.type ?? fields.docType) as
    | 'invoice'
    | 'proforma'
    | 'credit_note'
    | 'payment_receipt'

  const currencyAccounts = (accounts.data ?? []).filter((a) => a.currency === currency)
  const effectiveAccount =
    fields.bankAccountId && currencyAccounts.some((a) => a.id === fields.bankAccountId)
      ? fields.bankAccountId
      : (currencyAccounts.find((a) => a.defaultForCurrency)?.id ?? currencyAccounts[0]?.id ?? '')
  const account = currencyAccounts.find((a) => a.id === effectiveAccount)

  // The ČNB rate follows the tax point (DUZP; the issue date for non-payers) until the user edits it.
  const rateDate = vatPayer ? taxableDate : issueDate
  const loadRate = useCallback(
    async (cur: string, date: string) => {
      if (cur === 'CZK' || cur.length !== 3) return
      const request = ++rateRequest.current
      try {
        const r = await client.lookup.exchangeRate({ currency: cur, date })
        // Ignore a late answer for an older request/date.
        if (request !== rateRequest.current) return
        set({ exchangeRate: r.rate })
        setRateFor(date)
      } catch {
        /* the user can type the rate manually */
      }
    },
    [set],
  )
  useEffect(() => {
    if (!ready || currency === 'CZK' || rateTouched || rateFor === rateDate) return
    void loadRate(currency, rateDate)
  }, [ready, currency, rateDate, rateTouched, rateFor, loadRate])

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
  const rowTotals = lines.map((_, i) => totals?.lines[i]?.base)

  const customerRow = useQuery({
    ...orpc.contacts.get.queryOptions({ input: { id: fields.customer?.id ?? '' } }),
    enabled: !!fields.customer?.id,
  })
  const euReverseDomestic =
    vatPayer &&
    lines.some((l) => l.vatTreatment === 'eu_reverse_charge') &&
    customerRow.data?.country?.toUpperCase() === 'CZ'

  const payload = () => ({
    contactId: fields.customer?.id ?? null,
    bankAccountId: effectiveAccount || null,
    issueDate,
    taxableDate,
    dueDate: fields.dueDate,
    currency,
    exchangeRate: foreign && exchangeRate ? num(exchangeRate) : null,
    roundTotal,
    paymentMethod: fields.paymentMethod,
    language: fields.language,
    orderNumber: fields.orderNumber.trim() || null,
    introText: fields.introText || null,
    footerText: fields.footerText || null,
    privateNote: fields.privateNote || null,
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
  const current = JSON.stringify({ docType: fields.docType, ...payload() })
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
      if (andIssue && !fields.customer) throw new Error(t.needCustomer)
      if (andIssue && body.lines.length === 0) throw new Error(t.needLines)
      const submitted = JSON.stringify({ docType: fields.docType, ...body })
      const doc = draftId
        ? await client.documents.updateDraft({ id: draftId, patch: body })
        : await client.documents.createDraft({ ...body, type: fields.docType })
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

  const sheetDoc = useMemo(
    () =>
      formToSheet(
        {
          type,
          issueDate,
          taxableDate,
          dueDate: fields.dueDate,
          vatPayer,
          currency,
          exchangeRate,
          roundTotal,
          language: fields.language,
          paymentMethod: fields.paymentMethod,
          introText: fields.introText,
          footerText: fields.footerText,
          lines,
          customerName: fields.customer?.name ?? null,
        },
        { look: look.data, profile: profile.data, contact: customerRow.data, account },
      ),
    [
      type,
      issueDate,
      taxableDate,
      fields.dueDate,
      vatPayer,
      currency,
      exchangeRate,
      roundTotal,
      fields.language,
      fields.paymentMethod,
      fields.introText,
      fields.footerText,
      lines,
      fields.customer?.name,
      look.data,
      profile.data,
      customerRow.data,
      account,
    ],
  )

  return {
    fields,
    set,
    /** Moves the due date and DUZP along until the user has set them by hand. */
    setIssueDate(v: string) {
      set({
        issueDate: v,
        ...(taxableTouched.current ? {} : { taxableDate: v }),
        ...(!dueTouched.current && defaults.data
          ? { dueDate: addDays(v, defaults.data.dueDays) }
          : {}),
      })
    },
    setDueDate(v: string) {
      dueTouched.current = true
      set({ dueDate: v })
    },
    setTaxableDate(v: string) {
      taxableTouched.current = true
      set({ taxableDate: v })
    },
    setCurrency(code: string) {
      set({ currency: code })
      if (code !== 'CZK') {
        setRateTouched(false)
        setRateFor(null)
      }
    },
    setExchangeRate(v: string) {
      setRateTouched(true)
      set({ exchangeRate: v })
    },
    reloadRate() {
      setRateTouched(false)
      void loadRate(currency, rateDate)
    },
    ready,
    dirty,
    draftId,
    type,
    isProforma,
    vatPayer,
    foreign,
    defaults: defaults.data,
    supplier: profile.data,
    totals,
    rowTotals,
    sheetDoc,
    customerDetails: customerRow.data,
    euReverseDomestic,
    issueError,
    bank: {
      loaded: accounts.isSuccess,
      none: accounts.isSuccess && accounts.data.length === 0,
      forCurrency: currencyAccounts,
      selectedId: effectiveAccount,
      selected: account,
      missing: missingBank,
    },
    submit: {
      pending: save.isPending,
      saveDraft: () => save.mutate(false),
      issue: () => issueRef.current(),
      confirmNoBank: confirmNoBank && missingBank,
      cancelNoBank: () => setConfirmNoBank(false),
    },
    newLine: () => emptyLine(vatPayer ? '21' : '0'),
  }
}

export type InvoiceDraft = ReturnType<typeof useInvoiceDraft>
