import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repo = resolve(import.meta.dirname, '../../../..')
const css = readFileSync(join(repo, 'packages/ui/src/styles/globals.css'), 'utf8')

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`)
  const block = css.slice(start, css.indexOf('\n}', start))
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]]),
  ) as Record<string, string>
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number)
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const TEXT_PAIRS = [
  ['foreground', 'background'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'muted'],
  ['primary-foreground', 'primary'],
  ['brand-foreground', 'brand'],
  ['destructive', 'background'],
  ['success', 'background'],
  ['warning', 'background'],
  ['info', 'background'],
] as const

describe.each([':root', '.dark'])('%s tokens', (selector) => {
  const t = tokens(selector)

  it.each(TEXT_PAIRS)('%s on %s meets WCAG AA', (fg, bg) => {
    expect(contrast(t[fg] as string, t[bg] as string)).toBeGreaterThanOrEqual(4.5)
  })

  it('field borders are visible (WCAG 1.4.11)', () => {
    expect(contrast(t.input as string, t.background as string)).toBeGreaterThanOrEqual(3)
  })
})

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sources(path)
    return /\.(tsx|css)$/.test(name) ? [path] : []
  })
}

describe('motion and type rules (docs/agents/ui.md)', () => {
  const files = [join(repo, 'apps/web/src'), join(repo, 'packages/ui/src')]
    .flatMap(sources)
    .map((path) => ({ path, text: readFileSync(path, 'utf8') }))

  it.each([
    ['transition-all (name the properties)', /\btransition-all\b/],
    ['ease-in on UI (feels sluggish)', /\bease-in\b(?!-out)/],
    ['entering from scale 0', /scale\(0\)|\bscale-0\b/],
    ['serif in the app (documents only)', /\bfont-serif\b/],
  ])('no %s', (_rule, pattern) => {
    expect(files.filter((f) => pattern.test(f.text)).map((f) => f.path)).toEqual([])
  })
})
