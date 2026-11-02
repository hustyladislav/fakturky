import { describe, expect, test } from 'vitest'
import { fuzzyScore, parseIntent, searchTerm } from './palette-search'

describe('fuzzyScore', () => {
  test('ignores case and diacritics', () => {
    expect(fuzzyScore('Studio Lípa s.r.o.', 'lipa')).toBeGreaterThan(0)
    expect(fuzzyScore('Faktury po splatnosti', 'PO SPLATNOSTI')).toBeGreaterThan(0)
  })

  test('word start outranks a mid-word hit', () => {
    expect(fuzzyScore('Studio Lípa', 'lip')).toBeGreaterThan(fuzzyScore('Kaplice', 'lic'))
  })

  test('tolerates skipped letters, rejects unrelated text', () => {
    expect(fuzzyScore('Nastavení', 'nstvn')).toBeGreaterThan(0)
    expect(fuzzyScore('Nastavení', 'xyz')).toBe(-1)
  })

  test('every word must match', () => {
    expect(fuzzyScore('Nová faktura', 'nova faktura')).toBeGreaterThan(0)
    expect(fuzzyScore('Nová faktura', 'nova kontakt')).toBe(-1)
  })
})

describe('parseIntent', () => {
  test.each([
    ['faktura pro Studio Lípa', 'studio lipa'],
    ['vystav fakturu pro Studio Lípa', 'studio lipa'],
    ['Vystavit novou fakturu pro lipa', 'lipa'],
    ['nová faktura pro Kavárna U Mostu', 'kavarna u mostu'],
  ])('%s → invoice for contact', (q, name) => {
    expect(parseIntent(q)).toEqual({ kind: 'invoice-for', name })
  })

  test.each([
    ['zaplatit 2026-0028', '2026-0028'],
    ['Označit jako zaplacenou 2026-0028', '2026-0028'],
    ['uhradit 20260028', '20260028'],
  ])('%s → mark paid', (q, number) => {
    expect(parseIntent(q)).toEqual({ kind: 'mark-paid', number })
  })

  test('plain text is no intent', () => {
    expect(parseIntent('studio lipa')).toBeNull()
    expect(parseIntent('faktura')).toBeNull()
    expect(parseIntent('zaplatit')).toBeNull()
  })

  test('searchTerm narrows to the intent argument', () => {
    expect(searchTerm('vystav fakturu pro Studio Lípa')).toBe('studio lipa')
    expect(searchTerm('zaplatit 2026-0028')).toBe('2026-0028')
    expect(searchTerm('  lípa ')).toBe('lípa')
  })
})
