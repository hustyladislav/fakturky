import type { Db } from '@fakturky/db'

/** Who is calling and which organization they act on. Resolved by the transport adapter. */
export type Principal = {
  userId: string
  organizationId: string
  via: 'session' | 'apiKey'
}

export type BaseContext = {
  db: Db
  principal: Principal | null
}

export type AuthedContext = BaseContext & { principal: Principal }
