import type { RouterOutputs } from '@fakturky/core/router'
import { cs } from '@/i18n/cs'

type Doc = RouterOutputs['documents']['list'][number]

const cell = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
const decimal = (v: string) => v.replace('.', ',')

/** Semicolon-separated CSV (Excel in cs-CZ) of the given list rows. */
export function documentsToCsv(docs: Doc[]): string {
  const t = cs.invoices
  const head = [
    t.columns.number,
    t.columns.type,
    t.columns.customer,
    t.columns.issued,
    t.columns.due,
    t.columns.total,
    'Měna',
    t.columns.status,
  ]
  const rows = docs.map((d) => [
    d.number ?? '',
    t.type[d.type as keyof typeof t.type] ?? d.type,
    d.customerName ?? '',
    d.issueDate ?? '',
    d.dueDate ?? '',
    decimal(d.total),
    d.currency,
    t.status[d.displayStatus],
  ])
  return [head, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')
}

/** Saves the rows as `faktury-vyber.csv` (UTF-8 with BOM so Excel reads the diacritics). */
export function downloadCsv(docs: Doc[]) {
  const blob = new Blob([`﻿${documentsToCsv(docs)}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'faktury-vyber.csv'
  a.click()
  URL.revokeObjectURL(url)
}
