import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { FetchLike } from '../src/integrations/fetch.ts'

export function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')
}

export function mockFetch(
  handler: (url: string, init?: RequestInit) => { status?: number; body: string; json?: boolean } | Error,
): { fetch: FetchLike; calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = []
  const f: FetchLike = async (url, init) => {
    calls.push({ url, init })
    const r = handler(url, init)
    if (r instanceof Error) throw r
    return new Response(r.body, { status: r.status ?? 200 })
  }
  return { fetch: f, calls }
}
