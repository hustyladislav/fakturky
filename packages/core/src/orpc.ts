import { ORPCError, os } from '@orpc/server'
import { type AuthedContext, type BaseContext, MailError } from './context'
import { DomainError } from './errors'
import type { ProcedureMeta } from './meta'

const base = os.$context<BaseContext>().$meta<ProcedureMeta>({})

/** Enforces authentication and narrows the context to a known organization. */
const requireOrg = base.middleware(async ({ context, next }) => {
  if (!context.principal) throw new ORPCError('UNAUTHORIZED')
  return next({ context: context as AuthedContext })
})

/** The one place domain failures become oRPC errors, so no handler can leak one as a 500. */
const translateErrors = base.middleware(async ({ next }) => {
  try {
    return await next()
  } catch (e) {
    if (e instanceof DomainError) {
      throw new ORPCError(e.code, {
        message: e.message,
        ...(e.fields ? { data: { fields: e.fields } } : {}),
      })
    }
    if (e instanceof MailError) {
      throw new ORPCError('SERVICE_UNAVAILABLE', { message: e.reason, data: { reason: e.reason } })
    }
    throw e
  }
})

export const publicProcedure = base.use(translateErrors)
export const authed = publicProcedure.use(requireOrg)

/** Declare a procedure with its MCP / REST metadata in one place. */
export function procedure(meta: ProcedureMeta) {
  const o = meta.openapi
  return authed
    .meta(meta)
    .route(o ? { method: o.method, path: o.path, summary: o.summary, tags: o.tags } : {})
}
