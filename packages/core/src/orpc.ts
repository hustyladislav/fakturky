import { ORPCError, os } from '@orpc/server'
import type { AuthedContext, BaseContext } from './context'
import type { ProcedureMeta } from './meta'

const base = os.$context<BaseContext>().$meta<ProcedureMeta>({})

/** Enforces authentication and narrows the context to a known organization. */
const requireOrg = base.middleware(async ({ context, next }) => {
  if (!context.principal) throw new ORPCError('UNAUTHORIZED')
  return next({ context: context as AuthedContext })
})

export const publicProcedure = base
export const authed = base.use(requireOrg)

/** Declare a procedure with its MCP / REST metadata in one place. */
export function procedure(meta: ProcedureMeta) {
  const o = meta.openapi
  return authed
    .meta(meta)
    .route(o ? { method: o.method, path: o.path, summary: o.summary, tags: o.tags } : {})
}
