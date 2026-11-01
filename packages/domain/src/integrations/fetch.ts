export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface ClientOptions {
  /** Injectable fetch (defaults to global fetch). */
  fetch?: FetchLike
  /** Request timeout in ms (default 10 000). */
  timeoutMs?: number
}

export class IntegrationError extends Error {
  constructor(
    message: string,
    readonly code: 'http_error' | 'invalid_input' | 'bad_response' | 'unavailable',
    readonly status?: number,
  ) {
    super(message)
    this.name = 'IntegrationError'
  }
}

export async function request(
  url: string,
  init: RequestInit,
  opts: ClientOptions,
): Promise<Response> {
  const f: FetchLike = opts.fetch ?? ((u, i) => fetch(u, i))
  try {
    return await f(url, { ...init, signal: init.signal ?? AbortSignal.timeout(opts.timeoutMs ?? 10_000) })
  } catch (e) {
    throw new IntegrationError(`Request failed: ${(e as Error).message}`, 'unavailable')
  }
}
