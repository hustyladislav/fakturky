/**
 * EPO XML generators for the Czech VAT filings: Přiznání k DPH (DPHDP3), Kontrolní hlášení (DPHKH1) and
 * Souhrnné hlášení (DPHSHV). Output is validated against the official XSDs from adisspr.mfcr.cz in the tests.
 * Structure versions and field semantics: docs/research/vat-reports.md.
 *
 * All data are XML attributes; dates are `DD.MM.RRRR`; DP3 and SH amounts are whole CZK, KH amounts have 2 decimals.
 */
import { formatDateDotted, type IsoDate } from './dates.ts'
import { Decimal, parseDecimal } from './money.ts'
import {
  computeDp3,
  type Dp3ManualInput,
  type VatPeriod,
  type VatReport,
} from './vat-report.ts'

/** Structure versions read from the EPO structure pages dated 11. 8. 2026. */
export const EPO_STRUCTURE_VERSIONS = {
  DPHDP3: '03.01.04',
  DPHKH1: '03.01.15',
  DPHSHV: '02.01.05',
} as const

export interface VatTaxpayer {
  /** DIČ; `CZ` prefix, spaces and a legacy leading zero are tolerated — only the digits go into the XML. */
  dic: string
  /** Číslo finančního úřadu (`c_ufo`, 3 digits) from the ÚFO code list at mojedane.gov.cz. */
  taxOfficeCode: string
  /** Optional územní pracoviště (`c_pracufo`, 4 digits). */
  workplaceCode?: string | null
  /** F = fyzická osoba, P = právnická osoba. */
  type: 'F' | 'P'
  /** Full name of the person / company. */
  name: string
  /** For type F; derived from `name` (last word = surname) when missing. */
  firstName?: string | null
  lastName?: string | null
  /** Street with house number, e.g. `Dlouhá 12/3` or `Dolní Lhota 15`. */
  street?: string | null
  city?: string | null
  zip?: string | null
  email?: string | null
}

export interface XmlOptions {
  /** Date of filing (`d_poddp`). Default: omitted. */
  filedOn?: IsoDate
  /** Name/version of the generating software (`nazevSW`, `verzeSW`). */
  software?: { name: string; version: string }
}

export class VatXmlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VatXmlError'
  }
}

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\t\r\n]+/g, ' ')
}

type Attrs = Array<[string, string | undefined | null]>

function tag(name: string, attrs: Attrs): string {
  const body = attrs
    .filter((a): a is [string, string] => a[1] !== undefined && a[1] !== null && a[1] !== '')
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(' ')
  return `<${name}${body ? ` ${body}` : ''}/>`
}

const cut = (s: string | null | undefined, max: number): string | undefined =>
  s ? s.trim().slice(0, max) : undefined

/** Money with exactly 2 decimals, `.` separator, no grouping. */
function amount2(v: string): string {
  return parseDecimal(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
}

const isZero = (v: string) => parseDecimal(v).isZero()

export function taxpayerDicDigits(dic: string): string {
  const v = dic.replace(/[\s.-]/g, '').toUpperCase()
  const digits = v.startsWith('CZ') ? v.slice(2) : v
  if (!/^\d{1,10}$/.test(digits)) throw new VatXmlError('Invalid taxpayer DIČ')
  return digits
}

/** Splits `Dlouhá 12/3` into street, house number (č. popisné) and orientation number. */
export function parseCzechStreet(address: string): { street?: string; houseNo?: string; orientNo?: string } {
  const m = /^(.*?)[\s,]*(\d+)(?:\s*\/\s*([0-9A-Za-z]+))?$/.exec(address.trim())
  if (!m) return { street: address.trim() || undefined }
  const street = (m[1] ?? '').trim()
  return {
    ...(street ? { street } : {}),
    houseNo: m[2] ?? '',
    ...(m[3] ? { orientNo: m[3] } : {}),
  }
}

function splitName(t: VatTaxpayer): { first?: string; last?: string } {
  if (t.lastName) return { ...(t.firstName ? { first: t.firstName } : {}), last: t.lastName }
  const parts = t.name.trim().split(/\s+/)
  if (parts.length < 2) return { last: parts[0] }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
}

function validateTaxpayer(t: VatTaxpayer) {
  taxpayerDicDigits(t.dic)
  if (!/^\d{3}$/.test(t.taxOfficeCode)) throw new VatXmlError('Invalid tax office code (c_ufo)')
  if (t.workplaceCode && !/^\d{1,4}$/.test(t.workplaceCode)) {
    throw new VatXmlError('Invalid workplace code (c_pracufo)')
  }
}

/** `VetaP`; the SH structure has no e-mail attribute. */
function vetaP(t: VatTaxpayer, withEmail: boolean): string {
  validateTaxpayer(t)
  const addr = t.street ? parseCzechStreet(t.street) : {}
  const name = splitName(t)
  const zip = t.zip?.replace(/\s/g, '')
  return tag('VetaP', [
    ['c_ufo', t.taxOfficeCode],
    ['c_pracufo', t.workplaceCode ?? undefined],
    ['dic', taxpayerDicDigits(t.dic)],
    ['typ_ds', t.type],
    ...(t.type === 'F'
      ? ([
          ['jmeno', cut(name.first, 30)],
          ['prijmeni', cut(name.last, 36)],
        ] as Attrs)
      : ([['zkrobchjm', cut(t.name, 255)]] as Attrs)),
    ['ulice', cut(addr.street, 38)],
    ['c_orient', cut(addr.orientNo, 4)],
    ['c_pop', addr.houseNo && /^\d{1,6}$/.test(addr.houseNo) ? addr.houseNo : undefined],
    ['naz_obce', cut(t.city, 48)],
    ['psc', zip && /^\d{5}$/.test(zip) ? zip : cut(zip, 10)],
    ['stat', 'ČESKÁ REPUBLIKA'],
    ...(withEmail ? ([['email', cut(t.email, 255)]] as Attrs) : []),
  ])
}

function periodAttrs(p: VatPeriod): Attrs {
  return p.kind === 'month'
    ? [
        ['mesic', String(p.month)],
        ['rok', String(p.year)],
      ]
    : [
        ['ctvrt', String(p.quarter)],
        ['rok', String(p.year)],
      ]
}

function wrap(root: string, version: string, body: string[], opts: XmlOptions): string {
  const sw = opts.software ?? { name: 'Fakturky', version: '1' }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<Pisemnost nazevSW="${esc(sw.name)}" verzeSW="${esc(sw.version)}">`,
    `<${root} verzePis="${version}">`,
    ...body,
    `</${root}>`,
    '</Pisemnost>',
    '',
  ].join('\n')
}

const filedAttr = (opts: XmlOptions): [string, string | undefined] => [
  'd_poddp',
  opts.filedOn ? formatDateDotted(opts.filedOn) : undefined,
]

// ---------------------------------------------------------------------------------------------
// DPHDP3
// ---------------------------------------------------------------------------------------------

export function generateDp3Xml(
  report: VatReport,
  taxpayer: VatTaxpayer,
  manual: Dp3ManualInput = {},
  opts: XmlOptions = {},
): string {
  const f = computeDp3(report, manual)
  const nz = (v: string) => (v === '0' ? undefined : v)
  const body: string[] = [
    tag('VetaD', [
      ['dapdph_forma', 'B'],
      ['dokument', 'DP3'],
      ['k_uladis', 'DPH'],
      ...periodAttrs(report.period),
      ['typ_platce', 'P'],
      filedAttr(opts),
    ]),
    vetaP(taxpayer, true),
  ]

  // Both columns are always written for ř.1/2 so the filing is explicit about zero output tax.
  body.push(
    tag('Veta1', [
      ['obrat23', f.r1.base],
      ['dan23', f.r1.vat],
      ['obrat5', f.r2.base],
      ['dan5', f.r2.vat],
    ]),
  )
  const veta2: Attrs = [
    ['dod_zb', nz(f.r20)],
    ['pln_sluzby', nz(f.r21)],
    ['pln_vyvoz', nz(f.r22)],
    ['pln_rez_pren', nz(f.r25)],
    ['pln_ost', nz(f.r26)],
  ]
  if (veta2.some(([, v]) => v !== undefined)) body.push(tag('Veta2', veta2))

  const hasInput = [f.r40.base, f.r40.deduction, f.r41.base, f.r41.deduction].some((v) => v !== '0')
  if (hasInput) {
    body.push(
      tag('Veta4', [
        ['pln23', nz(f.r40.base)],
        ['odp_tuz23_nar', nz(f.r40.deduction)],
        ['pln5', nz(f.r41.base)],
        ['odp_tuz5_nar', nz(f.r41.deduction)],
        ['odp_sum_nar', f.r46],
      ]),
    )
  }
  body.push(
    tag('Veta6', [
      ['dan_zocelk', f.r62],
      ['odp_zocelk', f.r63],
      ['dano_da', f.r64],
      ['dano_no', f.r65],
    ]),
  )
  return wrap('DPHDP3', EPO_STRUCTURE_VERSIONS.DPHDP3, body, opts)
}

// ---------------------------------------------------------------------------------------------
// DPHKH1
// ---------------------------------------------------------------------------------------------

export function generateKhXml(report: VatReport, taxpayer: VatTaxpayer, opts: XmlOptions = {}): string {
  const body: string[] = [
    tag('VetaD', [
      ['dokument', 'KH1'],
      ['k_uladis', 'DPH'],
      ...periodAttrs(report.period),
      ['khdph_forma', 'B'],
      filedAttr(opts),
    ]),
    vetaP(taxpayer, true),
  ]

  const evid = (n: string) => cut(n, 60)
  for (const r of report.kh.a1) {
    body.push(
      tag('VetaA1', [
        ['c_evid_dd', evid(r.number)],
        ['dic_odb', r.dicOdb],
        ['duzp', formatDateDotted(r.duzp)],
        ['zakl_dane1', amount2(r.base)],
        ['kod_pred_pl', r.code],
      ]),
    )
  }
  for (const r of report.kh.a4) {
    const p21 = !isZero(r.base21) || !isZero(r.vat21)
    const p12 = !isZero(r.base12) || !isZero(r.vat12)
    body.push(
      tag('VetaA4', [
        ['c_evid_dd', evid(r.number)],
        ['dic_odb', r.dicOdb],
        ['dppd', formatDateDotted(r.dppd)],
        ['zakl_dane1', p21 ? amount2(r.base21) : undefined],
        ['dan1', p21 ? amount2(r.vat21) : undefined],
        ['zakl_dane2', p12 ? amount2(r.base12) : undefined],
        ['dan2', p12 ? amount2(r.vat12) : undefined],
        ['kod_rezim_pl', '0'],
        ['zdph_44', 'N'],
      ]),
    )
  }
  const a5 = report.kh.a5
  const a21 = !isZero(a5.base21) || !isZero(a5.vat21)
  const a12 = !isZero(a5.base12) || !isZero(a5.vat12)
  if (a21 || a12) {
    body.push(
      tag('VetaA5', [
        ['zakl_dane1', a21 ? amount2(a5.base21) : undefined],
        ['dan1', a21 ? amount2(a5.vat21) : undefined],
        ['zakl_dane2', a12 ? amount2(a5.base12) : undefined],
        ['dan2', a12 ? amount2(a5.vat12) : undefined],
      ]),
    )
  }
  return wrap('DPHKH1', EPO_STRUCTURE_VERSIONS.DPHKH1, body, opts)
}

// ---------------------------------------------------------------------------------------------
// DPHSHV
// ---------------------------------------------------------------------------------------------

export function generateShXml(report: VatReport, taxpayer: VatTaxpayer, opts: XmlOptions = {}): string {
  const body: string[] = [
    tag('VetaD', [
      ['k_uladis', 'DPH'],
      ['dokument', 'SHV'],
      ...periodAttrs(report.period),
      ['shvies_forma', 'R'],
      filedAttr(opts),
    ]),
    vetaP(taxpayer, false),
  ]
  report.sh.forEach((r, i) => {
    body.push(
      tag('VetaR', [
        ['c_rad', i < 99 ? String(i + 1) : undefined], // XSD: max 2 digits
        ['k_stat', r.country],
        ['c_vat', r.vatNumber.slice(0, 12)],
        ['k_pln_eu', r.code],
        ['pln_pocet', String(r.count)],
        ['pln_hodnota', r.valueWhole],
      ]),
    )
  })
  return wrap('DPHSHV', EPO_STRUCTURE_VERSIONS.DPHSHV, body, opts)
}
