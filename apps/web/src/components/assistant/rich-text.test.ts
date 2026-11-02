import { expect, test } from 'vitest'
import { inlineParts } from './rich-text'

test('splits bold and code, leaves everything else as text', () => {
  expect(inlineParts('Faktura **2026-0001** je `hotová`.')).toEqual([
    { kind: 'text', text: 'Faktura ' },
    { kind: 'bold', text: '2026-0001' },
    { kind: 'text', text: ' je ' },
    { kind: 'code', text: 'hotová' },
    { kind: 'text', text: '.' },
  ])
})

test('HTML stays text (React escapes it)', () => {
  expect(inlineParts('<img src=x onerror=alert(1)>')).toEqual([
    { kind: 'text', text: '<img src=x onerror=alert(1)>' },
  ])
})

test('links: https and internal paths become links, javascript: stays text', () => {
  expect(inlineParts('[web](https://example.cz) [faktura](/faktury/1)')).toEqual([
    { kind: 'link', text: 'web', href: 'https://example.cz/' },
    { kind: 'text', text: ' ' },
    { kind: 'link', text: 'faktura', href: '/faktury/1' },
  ])
  expect(inlineParts('[x](javascript:alert1)').some((p) => p.kind === 'link')).toBe(false)
})
