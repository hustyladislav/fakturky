import type { JobName } from '@fakturky/core/jobs'
import { isCronAuthorized } from './cron-auth'

/** A Vercel Cron request: authorise, run the named core job, answer with its summary. */
export async function runCronJob(request: Request, name: JobName): Promise<Response> {
  if (!isCronAuthorized(request)) return new Response('Unauthorized', { status: 401 })
  const [{ jobs }, { createContext }] = await Promise.all([
    import('@fakturky/core/jobs'),
    import('./context'),
  ])
  const ctx = await createContext(request.headers)
  return Response.json(await jobs[name](ctx.db, ctx.services))
}
