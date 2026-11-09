type Paid = { id: string; payments: readonly { id: string; createdAt: Date }[] }

/** What undoes a one-click "mark paid": the payment it just added, which is the newest recorded. */
export function undoPaidInput(paid: Paid) {
  const added = paid.payments.reduce<Paid['payments'][number] | undefined>(
    (newest, p) => (newest && newest.createdAt > p.createdAt ? newest : p),
    undefined,
  )
  // Without an id the API would remove every payment, so no id means nothing to undo.
  return added ? { id: paid.id, paymentId: added.id } : null
}
