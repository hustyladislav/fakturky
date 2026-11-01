import type { Db, schema } from '@fakturky/db'

/** Who is calling and which organization they act on. Resolved by the transport adapter. */
export type Principal = {
  userId: string
  organizationId: string
  via: 'session' | 'apiKey' | 'oauth'
}

/** Heavy or host-specific capabilities injected by the transport adapter (kept out of core's dependency graph). */
export type Services = {
  /** Renders an issued document to PDF bytes. */
  renderPdf?: (doc: IssuedDocument, lines: IssuedLine[]) => Promise<Uint8Array>
}

export type IssuedDocument = typeof schema.document.$inferSelect
export type IssuedLine = typeof schema.documentLine.$inferSelect

export type BaseContext = {
  db: Db
  principal: Principal | null
  services?: Services
}

export type AuthedContext = BaseContext & { principal: Principal }
