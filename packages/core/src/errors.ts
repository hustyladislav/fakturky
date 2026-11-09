import { ORPCError } from '@orpc/server'

/** A business rule said no. `procedure` turns it into the matching oRPC error; `fields` name the inputs at fault. */
export class DomainError extends Error {
  constructor(
    readonly code:
      | 'NOT_FOUND'
      | 'CONFLICT'
      | 'PRECONDITION_FAILED'
      | 'BAD_REQUEST'
      | 'TOO_MANY_REQUESTS',
    message: string,
    readonly fields?: string[],
  ) {
    super(message)
  }
}

/** Resolves a lookup; a missing row is NOT_FOUND. */
export async function orNotFound<T>(fn: () => Promise<T | null>, what = 'Not found'): Promise<T> {
  const out = await fn()
  if (out === null) throw new ORPCError('NOT_FOUND', { message: what })
  return out
}
