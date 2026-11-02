import type { Db, schema } from '@fakturky/db'

/** Who is calling and which organization they act on. Resolved by the transport adapter. */
export type Principal = {
  userId: string
  organizationId: string
  via: 'session' | 'apiKey' | 'oauth' | 'assistant'
}

/** Heavy or host-specific capabilities injected by the transport adapter (kept out of core's dependency graph). */
export type SendInvoiceArgs = {
  to: string
  replyTo: string | null
  supplierName: string
  number: string
  /** Pre-formatted amount with currency. */
  total: string
  dueDate: string
  publicUrl: string
  /** Hosted PNG of the payment QR (`/f/:token/qr.png`); null when there is nothing to pay by transfer. */
  qrUrl: string | null
  message: string | null
  isReminder: boolean
  language: 'cs' | 'sk' | 'en'
  pdf: { filename: string; bytes: Uint8Array }
}

/** Why an e-mail could not be delivered; mapped to a Czech message by the UI. */
export type MailFailure = 'EMAIL_NOT_CONFIGURED' | 'EMAIL_RESTRICTED' | 'EMAIL_FAILED'

export class MailError extends Error {
  constructor(readonly reason: MailFailure) {
    super(reason)
  }
}

export type Services = {
  /** Public origin used for `/f/:token` links in e-mails. */
  publicBaseUrl?: string
  /** Delivers an invoice/reminder; throws `MailError`. */
  sendInvoice?: (args: SendInvoiceArgs) => Promise<void>
  /** HTTP transport for outbound integrations (Fakturoid import); tests inject recorded responses. */
  fetch?: (input: string, init?: RequestInit) => Promise<Response>
  /** Renders an issued document to PDF bytes. */
  renderPdf?: (
    doc: IssuedDocument,
    lines: IssuedLine[],
    original?: OriginalDocument | null,
  ) => Promise<Uint8Array>
}

/** The corrected document of a credit note. */
export type OriginalDocument = { number: string; issueDate: string; uuid: string }

export type IssuedDocument = typeof schema.document.$inferSelect
export type IssuedLine = typeof schema.documentLine.$inferSelect

export type BaseContext = {
  db: Db
  principal: Principal | null
  services?: Services
}

export type AuthedContext = BaseContext & { principal: Principal }
