type Paid = { id: string; payments: readonly { id: string; createdAt: Date }[] }

/** What undoes a one-click "mark paid": the payment it just added, which is the newest recorded. */
export function undoPaidInput(paid: Paid) {
  const added = paid.payments.reduce<Paid['payments'][number] | undefined>(
    (newest, p) => (newest && newest.createdAt > p.createdAt ? newest : p),
    undefined,
  )
  return { id: paid.id, paymentId: added?.id }
}
