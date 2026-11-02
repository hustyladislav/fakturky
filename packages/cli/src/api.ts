import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { BRAND } from '@fakturky/core/brand'
import { configDir, specCacheFile } from './config'
import { type Operation, parseSpec } from './spec'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export type Credentials = { apiKey?: string; url: string }

export async function request(
  creds: Credentials,
  method: string,
  path: string,
  options: { query?: Record<string, unknown>; body?: unknown } = {},
): Promise<unknown> {
  const url = new URL(`${creds.url}/api/v1${path}`)
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v))
  }
  const res = await fetch(url, {
    method,
    headers: {
      accept: 'application/json',
      'user-agent': `${BRAND.slug}-cli`,
      ...(creds.apiKey ? { authorization: `Bearer ${creds.apiKey}` } : {}),
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  const text = await res.text()
  let data: unknown = text
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // non-JSON (e.g. ISDOC XML): keep raw text
  }
  if (!res.ok) {
    let message =
      data && typeof data === 'object' && 'message' in data ? String(data.message) : res.statusText
    // Validation failures carry the offending fields: show them instead of a bare "Input validation failed".
    const issues = (data as { data?: { issues?: { path?: unknown[]; message?: string }[] } } | null)
      ?.data?.issues
    if (Array.isArray(issues) && issues.length > 0) {
      message += `\n${issues
        .map(
          (i) =>
            `  - ${(i.path ?? []).map(String).join('.') || '(body)'}: ${i.message ?? 'invalid'}`,
        )
        .join('\n')}`
    }
    const fields = (data as { data?: { fields?: unknown } } | null)?.data?.fields
    if (Array.isArray(fields) && fields.length > 0) message += `\n  Missing: ${fields.join(', ')}`
    throw new ApiError(res.status, message)
  }
  return data
}

const SPEC_TTL_MS = 60 * 60 * 1000

/** OpenAPI spec of the configured server, cached on disk for an hour; null when unreachable. */
export async function loadOperations(url: string): Promise<Operation[] | null> {
  const file = specCacheFile()
  try {
    const [info, cached] = await Promise.all([stat(file), readFile(file, 'utf8')])
    const parsed = JSON.parse(cached) as { url: string; spec: unknown }
    if (parsed.url === url && Date.now() - info.mtimeMs < SPEC_TTL_MS) {
      return parseSpec(parsed.spec as never)
    }
  } catch {
    // no usable cache
  }
  try {
    const res = await fetch(`${url}/api/v1/openapi.json`, {
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return null
    const spec = await res.json()
    await mkdir(configDir(), { recursive: true, mode: 0o700 })
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, JSON.stringify({ url, spec }))
    return parseSpec(spec as never)
  } catch {
    return null
  }
}
