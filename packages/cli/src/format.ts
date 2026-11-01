const isScalar = (v: unknown) => v === null || ['string', 'number', 'boolean'].includes(typeof v)

const cell = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

/** Human-readable rendering: array of objects → table, object → key/value lines, else JSON. */
export function render(value: unknown, width = process.stdout.columns ?? 100): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '(žádné záznamy)'
    if (value.every((row) => row && typeof row === 'object' && !Array.isArray(row))) {
      return table(value as Record<string, unknown>[], width)
    }
    return value.map(cell).join('\n')
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    const pad = Math.max(...entries.map(([k]) => k.length))
    return entries
      .map(([k, v]) => `${k.padEnd(pad)}  ${isScalar(v) ? cell(v) : JSON.stringify(v)}`)
      .join('\n')
  }
  return cell(value)
}

function table(rows: Record<string, unknown>[], width: number): string {
  const hidden = new Set(['organizationId', 'updatedAt'])
  const keys = [
    ...new Set(rows.flatMap((r) => Object.keys(r).filter((k) => isScalar(r[k]) && !hidden.has(k)))),
  ].filter((k) => rows.some((r) => cell(r[k]) !== ''))
  const widths = new Map<string, number>()
  const chosen: string[] = []
  let used = 0
  for (const key of keys) {
    const w = Math.min(Math.max(key.length, ...rows.map((r) => cell(r[key]).length)), 36)
    if (chosen.length > 0 && used + w + 2 > width) continue
    chosen.push(key)
    widths.set(key, w)
    used += w + 2
  }
  const fit = (s: string, w: number) => (s.length > w ? `${s.slice(0, w - 1)}…` : s.padEnd(w))
  const header = chosen.map((k) => fit(k, widths.get(k) ?? 0)).join('  ')
  const lines = rows.map((r) => chosen.map((k) => fit(cell(r[k]), widths.get(k) ?? 0)).join('  '))
  return [header, ...lines].join('\n')
}
