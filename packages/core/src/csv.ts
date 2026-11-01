/** Semicolon-separated, UTF-8 with BOM: opens correctly in Czech Excel. */
const BOM = '﻿'

/** Neutralises spreadsheet formula injection and quotes when needed. */
function cell(value: unknown): string {
  let s = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return `${BOM}${[header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')}\r\n`
}
