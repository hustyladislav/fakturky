import { describe, expect, it } from 'vitest'
import { typesetCopy, typesetCzech } from './typeset'

const nb = (s: string) => s.replaceAll('~', ' ')

describe('typesetCzech', () => {
  it.each([
    ['Zdarma u nás a v bezplatných tarifech jinde', 'Zdarma u~nás a~v~bezplatných tarifech jinde'],
    ['ověřte u poskytovatele', 'ověřte u~poskytovatele'],
    ['Kód je otevřený. A to je vše', 'Kód je otevřený. A~to je vše'],
    ['Doplnit z ARES', 'Doplnit z~ARES'],
    ['(k dispozici)', '(k~dispozici)'],
    ['jen pro 5 odběratelů', 'jen pro 5~odběratelů'],
    ['1 500 API požadavků', '1~500~API požadavků'],
    ['ke dni 2. 11. 2026.', 'ke dni 2.~11.~2026.'],
  ])('binds %j', (input, expected) => {
    expect(typesetCzech(input)).toBe(nb(expected))
  })

  it.each([
    ['nás a', 'a word ending in a one-letter preposition, a trailing letter'],
    ['Studio Lípa s.r.o. platí', 'an abbreviation'],
    ['Viz https://example.cz/a/v1?o=1', 'a URL'],
    ['Rok 2026. Další věta', 'a number ending a sentence'],
    ['Nastavení → API klíče', 'no single letters'],
  ])('leaves %j alone (%s)', (input) => {
    expect(typesetCzech(input)).toBe(input)
  })

  it('keeps already-bound text as it is', () => {
    const bound = nb('a~v~bezplatných')
    expect(typesetCzech(bound)).toBe(bound)
    expect(typesetCzech(typesetCzech('u nás a v ceníku'))).toBe(typesetCzech('u nás a v ceníku'))
  })
})

describe('typesetCopy', () => {
  it('walks objects, arrays and function results and leaves other values', () => {
    const copy = typesetCopy({
      title: 'Zdarma u nás',
      rows: [['A b', 'yes']] as const,
      count: 3,
      fields: (n: number) => `${n} faktur v ceníku`,
    })
    expect(copy.title).toBe(nb('Zdarma u~nás'))
    expect(copy.rows[0]).toEqual([nb('A~b'), 'yes'])
    expect(copy.count).toBe(3)
    expect(copy.fields(5)).toBe(nb('5~faktur v~ceníku'))
  })
})
