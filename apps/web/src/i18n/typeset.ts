const NBSP = ' '

// Czech typesetting: no one-letter preposition or conjunction at a line end, no number split from what it counts.
const SINGLE_LETTER = /(?<![\p{L}\p{N}])([kKsSvVzZoOuUaAiI]) +(?=\S)/gu
const NUMBER = /(\d\.?) +(?=\d)|(\d) +(?=\p{L})/gu

/** Binds what must not end a line with a no-break space; ASCII spaces only, so already-bound text is kept. */
export function typesetCzech(text: string): string {
  return text
    .replace(SINGLE_LETTER, `$1${NBSP}`)
    .replace(
      NUMBER,
      (_m, num: string | undefined, digit: string | undefined) => `${num ?? digit}${NBSP}`,
    )
}

/** `typesetCzech` over every string of a copy tree; functions get their results typeset. Types stay intact. */
export function typesetCopy<const T>(value: T): T {
  if (typeof value === 'string') return typesetCzech(value) as T
  if (Array.isArray(value)) return value.map(typesetCopy) as T
  if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown
    return ((...args: unknown[]) => typesetCopy(fn(...args))) as T
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, typesetCopy(v)])) as T
  }
  return value
}
