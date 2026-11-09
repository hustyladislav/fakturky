import { parseDecimal } from '@fakturky/domain/money'
import { formatDate, parseIsoDate } from '@fakturky/ui/lib/dates'
import { moneyParts } from '@fakturky/ui/lib/money'
import { cs } from '../../i18n/cs'

const t = cs.assistant.summary

export type SummaryDoc = {
  number: string | null
  customerName: string | null
  currency: string
  total: string
  vatTotal: string
  dueDate: string | null
  lines: ReadonlyArray<{ description: string; quantity: string; unitPrice: string }>
}

export type ApprovalSummary = { title: string; facts: string[] }

/** `1 500 Kč`, `148,50 EUR`: no ",00" in running text. */
function money(amount: string, currency: string) {
  const p = moneyParts(amount, currency)
  return `${p.negative ? '−' : ''}${p.integer}${p.fraction === '00' ? '' : `,${p.fraction}`} ${p.currency}`
}

const plain = (v: string) => (v.includes('.') ? v.replace(/\.?0+$/, '') : v)

/** Tools whose argument is the id of a document: the card shows that document instead of JSON. */
export const DOCUMENT_TOOLS: ReadonlySet<string> = new Set([
  'issue_invoice',
  'mark_document_paid',
  'cancel_document',
  'delete_document_draft',
  'send_invoice_email',
])

/** Human summary of a document-targeted approval: what happens, to whom, how much. */
export function documentSummary(tool: string, doc: SummaryDoc): ApprovalSummary | null {
  const who = doc.customerName ?? '—'
  const ref = doc.number ?? who
  const title =
    tool === 'issue_invoice'
      ? t.issue(who)
      : tool === 'mark_document_paid'
        ? t.markPaid(ref)
        : tool === 'cancel_document'
          ? t.cancel(ref)
          : tool === 'delete_document_draft'
            ? t.deleteDraft(who)
            : tool === 'send_invoice_email'
              ? t.send(ref)
              : null
  if (!title) return null

  const facts: string[] = []
  const [only] = doc.lines
  if (doc.lines.length === 1 && only) {
    facts.push(`${plain(only.quantity)} × ${money(only.unitPrice, doc.currency)}`)
  } else if (doc.lines.length > 1) {
    facts.push(t.lines(doc.lines.length))
  }
  facts.push(t.total(money(doc.total, doc.currency), !parseDecimal(doc.vatTotal).isZero()))
  const due = parseIsoDate(doc.dueDate)
  if (due && tool === 'issue_invoice') facts.push(t.due(formatDate(due)))
  return { title, facts }
}
