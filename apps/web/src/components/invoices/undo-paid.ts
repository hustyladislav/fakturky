/**
 * What undoes a one-click "mark paid": the payment it just added and no other. It is the last one
 * because the API lists payments oldest first and this action always dates its payment today.
 */
export function undoPaidInput(paid: { id: string; payments: readonly { id: string }[] }) {
  return { id: paid.id, paymentId: paid.payments.at(-1)?.id }
}
