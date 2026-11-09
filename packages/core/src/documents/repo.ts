import { createCreditNote, createFinalInvoice, createPaymentReceipt } from './derived'
import { createDraft, deleteDraft, duplicate, updateDraft } from './drafts'
import { issue } from './issue'
import { cancel, rotatePublicToken, tagAssistant } from './lifecycle'
import { markPaid, markUnpaid } from './payments'
import { defaults, forExport, get, list, stats } from './queries'
import { send } from './send'

/** Everything that reads or changes a document, always inside one organization. */
export const documentsRepo = {
  forExport,
  defaults,
  list,
  stats,
  get,
  createDraft,
  updateDraft,
  duplicate,
  deleteDraft,
  issue,
  send,
  createPaymentReceipt,
  createFinalInvoice,
  createCreditNote,
  markPaid,
  markUnpaid,
  cancel,
  rotatePublicToken,
  tagAssistant,
}
