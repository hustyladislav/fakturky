import { parseDecimal } from '../money.ts'
import { blankToNull, cleanSymbol, parseBankAmount, parseBankDate } from './text.ts'
import { type ParsedStatement, type ParsedTransaction, StatementParseError } from './types.ts'
import { type XNode, all, at, find, parseXml, textAt } from './xml.ts'

/** Czech convention: "/VS123/SS456/KS0308" in EndToEndId or the unstructured remittance text. */
function symbolFrom(text: string | null, tag: 'VS' | 'SS' | 'KS'): string | null {
  if (!text) return null
  const m = new RegExp(`/${tag}(\\d{1,10})(?=/|$|\\s)`).exec(text)
  return cleanSymbol(m?.[1])
}

function accountOf(acct: XNode | undefined, agent: XNode | undefined): string | null {
  const iban = textAt(acct, 'Id/IBAN')
  if (iban) return iban
  const other = textAt(acct, 'Id/Othr/Id')
  if (!other) return null
  const bank =
    textAt(agent, 'FinInstnId/ClrSysMmbId/MmbId') ?? textAt(agent, 'FinInstnId/Othr/Id') ?? null
  return bank && !other.includes('/') ? `${other}/${bank}` : other
}

/** CAMT.053 (also 052/054) bank-to-customer statement; handles 001.02 and the 001.08 `Pty` wrappers. */
export function parseCamt053(xml: string): ParsedStatement {
  let root: XNode
  try {
    root = parseXml(xml)
  } catch (e) {
    throw new StatementParseError(`Invalid XML: ${(e as Error).message}`)
  }
  if (root.name !== 'Document') {
    throw new StatementParseError('Not a CAMT document (missing <Document> root)')
  }
  const container = root.children[0]
  const statements = [...all(container, 'Stmt'), ...all(container, 'Rpt'), ...all(container, 'Ntfctn')]
  if (statements.length === 0) {
    throw new StatementParseError('Not a CAMT.053 statement (no <Stmt> found)')
  }
  const warnings: string[] = []
  const transactions: ParsedTransaction[] = []
  let iban: string | null = null

  for (const stmt of statements) {
    iban ??= textAt(stmt, 'Acct/Id/IBAN')
    const stmtCcy = textAt(stmt, 'Acct/Ccy')
    for (const [n, entry] of all(stmt, 'Ntry').entries()) {
      const status = textAt(entry, 'Sts') ?? textAt(entry, 'Sts/Cd')
      if (status && status !== 'BOOK') continue
      const indicator = textAt(entry, 'CdtDbtInd')
      if (indicator !== 'CRDT' && indicator !== 'DBIT') {
        warnings.push(`Entry ${n + 1}: skipped (no CdtDbtInd)`)
        continue
      }
      const reversal = textAt(entry, 'RvslInd') === 'true'
      const credit = (indicator === 'CRDT') !== reversal
      const bookedOn =
        parseBankDate(textAt(entry, 'BookgDt/Dt') ?? textAt(entry, 'BookgDt/DtTm') ?? '') ??
        parseBankDate(textAt(entry, 'ValDt/Dt') ?? textAt(entry, 'ValDt/DtTm') ?? '')
      const entryAmt = at(entry, 'Amt')
      const entryRef =
        textAt(entry, 'NtryRef') ?? textAt(entry, 'AcctSvcrRef') ?? null
      const details = all(at(entry, 'NtryDtls'), 'TxDtls')
      const parts = details.length > 1 ? details : [details[0]]
      for (const [i, tx] of parts.entries()) {
        const amtNode = details.length > 1 ? (at(tx, 'AmtDtls/TxAmt/Amt') ?? at(tx, 'Amt')) : entryAmt
        const raw = amtNode?.text.trim()
        const amountAbs = raw ? parseBankAmount(raw, 'dot') : null
        const currency = (amtNode?.attrs.Ccy ?? entryAmt?.attrs.Ccy ?? stmtCcy)?.toUpperCase()
        if (!bookedOn || !amountAbs || amountAbs.startsWith('-') || !currency) {
          warnings.push(`Entry ${n + 1}: skipped (missing date, amount or currency)`)
          continue
        }
        const amount = credit || parseDecimal(amountAbs).isZero() ? amountAbs : `-${amountAbs}`
        const parties = at(tx, 'RltdPties')
        const partyNode = find(parties, credit ? 'Dbtr' : 'Cdtr')
        const acctNode = at(parties, credit ? 'DbtrAcct' : 'CdtrAcct')
        const agent = at(tx, 'RltdAgts')
        const agentNode = at(agent, credit ? 'DbtrAgt' : 'CdtrAgt')
        const endToEnd = textAt(tx, 'Refs/EndToEndId')
        const ustrd = all(at(tx, 'RmtInf'), 'Ustrd')
          .map((u) => u.text.trim())
          .filter(Boolean)
        const info = [endToEnd, ...ustrd, textAt(tx, 'Refs/PmtInfId')].join(' ')
        const structuredRef = textAt(tx, 'RmtInf/Strd/CdtrRefInf/Ref')
        const message = blankToNull(ustrd.join(' '))
        const ref =
          textAt(tx, 'Refs/AcctSvcrRef') ?? (entryRef ? (details.length > 1 ? `${entryRef}#${i}` : entryRef) : null)
        transactions.push({
          bookedOn,
          amount,
          currency,
          variableSymbol:
            symbolFrom(endToEnd, 'VS') ?? symbolFrom(info, 'VS') ?? cleanSymbol(structuredRef),
          constantSymbol: symbolFrom(info, 'KS'),
          specificSymbol: symbolFrom(info, 'SS'),
          counterpartyAccount: accountOf(acctNode, agentNode),
          counterpartyName: blankToNull(textAt(partyNode, 'Nm') ?? textAt(partyNode, 'Pty/Nm') ?? ''),
          message,
          externalId: ref,
        })
      }
    }
  }
  return { format: 'camt053', iban, accountNumber: null, transactions, warnings }
}
