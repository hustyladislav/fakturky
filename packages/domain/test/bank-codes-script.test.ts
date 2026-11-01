import { describe, expect, it } from 'vitest'
import { parseBankCsv, renderBankCodes } from '../scripts/generate-bank-codes.ts'

const CSV = '﻿Kód platebního styku;Poskytovatel platebních služeb;BIC kód (SWIFT);Systém CERTIS\r\n0800;Česká spořitelna, a.s.;GIBACZPX;A\r\n0100;Komerční banka, a.s.;KOMBCZPP;A\r\n9999;Bez BIC;;N\r\nbad;row;;\r\n\r\n'

describe('bank code generator', () => {
  it('parses, sorts and skips junk rows', () => {
    expect(parseBankCsv(CSV)).toEqual([
      { code: '0100', name: 'Komerční banka, a.s.', bic: 'KOMBCZPP' },
      { code: '0800', name: 'Česká spořitelna, a.s.', bic: 'GIBACZPX' },
      { code: '9999', name: 'Bez BIC', bic: null },
    ])
  })

  it('renders a module', () => {
    const out = renderBankCodes(parseBankCsv(CSV), '2026-11-01')
    expect(out).toContain("{ code: '9999', name: \"Bez BIC\", bic: null },")
    expect(out).toContain('export function findBank')
  })
})
