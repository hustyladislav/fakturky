export type ActionId =
  | 'issue'
  | 'share'
  | 'pay'
  | 'receipt'
  | 'final'
  | 'pdf'
  | 'edit'
  | 'send'
  | 'markUnpaid'
  | 'duplicate'
  | 'template'
  | 'credit'
  | 'cancel'
  | 'delete'

/** What the plan needs to know about a document (a structural subset of the detail payload). */
export type ActionInput = {
  type: string
  status: string
  displayStatus: string
  total: string
  hasPublicLink: boolean
  /** The customer was already reached: sent, reminded or viewed. */
  reached: boolean
  related: { type: string; status: string }[]
  /** `undefined` until the business profile has loaded; receipts and final invoices wait for it. */
  vatPayer: boolean | undefined
}

export type ActionPlan = {
  /** The one ink button. */
  primary: ActionId
  /** Quiet buttons next to it, in display order. */
  secondary: ActionId[]
  /** Rarely used actions behind "Více", in display order. */
  more: ActionId[]
  /** "Odeslat" turns into a reminder for an overdue invoice. */
  sendIsReminder: boolean
}

/** One place that decides which actions a document offers in its current state. */
export function planActions(d: ActionInput): ActionPlan {
  const isDraft = d.status === 'draft'
  const open = d.status === 'issued' && d.type !== 'credit_note'
  const isProforma = d.type === 'proforma'
  const known = d.vatPayer !== undefined
  const hasReceipt = d.related.some((r) => r.type === 'payment_receipt' && r.status !== 'cancelled')
  const canReceipt = isProforma && d.status === 'paid' && d.vatPayer === true && !hasReceipt
  const canFinal =
    isProforma &&
    d.status === 'paid' &&
    known &&
    (!d.vatPayer || d.related.some((r) => r.type === 'payment_receipt' && r.status === 'paid'))
  const canSend = open || d.status === 'paid' || (d.type === 'credit_note' && d.status === 'issued')
  const canCredit = d.type === 'invoice' && (open || d.status === 'paid')
  const canMarkUnpaid = d.status === 'paid' && !(d.type === 'invoice' && Number(d.total) <= 0)

  // A fresh invoice still has to reach the customer; once it was sent or viewed, or is late, getting
  // paid is the next step. The PDF is primary only when nothing else is left to do.
  const payFirst = !d.hasPublicLink || d.reached || d.displayStatus !== 'issued'
  const primary: ActionId = isDraft
    ? 'issue'
    : open
      ? payFirst
        ? 'pay'
        : 'share'
      : canReceipt
        ? 'receipt'
        : canFinal
          ? 'final'
          : 'pdf'

  const secondary: ActionId[] = []
  if (isDraft) secondary.push('edit')
  if (primary === 'share') secondary.push('pay')
  if (primary === 'pay' && d.hasPublicLink) secondary.push('share')
  if (!isDraft && canSend) secondary.push('send')
  if (!isDraft && primary !== 'pdf') secondary.push('pdf')

  const more: ActionId[] = []
  if (isDraft) {
    more.push('delete')
  } else {
    if (canMarkUnpaid) more.push('markUnpaid')
    more.push('duplicate', 'template')
    if (canCredit) more.push('credit')
    if (canReceipt && primary !== 'receipt') more.push('receipt')
    if (canFinal && primary !== 'final') more.push('final')
    if (d.status !== 'cancelled') more.push('cancel')
  }

  return { primary, secondary, more, sendIsReminder: d.displayStatus === 'overdue' }
}
