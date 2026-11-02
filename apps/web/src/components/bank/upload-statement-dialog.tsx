import {
  decodeBankFile,
  type ParsedStatement,
  parseStatement,
  readDelimited,
} from '@fakturky/domain/bank'
import { formatDateCs } from '@fakturky/domain/dates'
import { Button } from '@fakturky/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@fakturky/ui/components/dialog'
import { Label } from '@fakturky/ui/components/label'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { formatMoney } from '@fakturky/ui/lib/money'
import { cn } from '@fakturky/ui/lib/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cs } from '@/i18n/cs'
import { orpc } from '@/lib/orpc'
import { bankErrorMessage, needsMapping } from './bank-errors'

const t = cs.bank

const MAP_FIELDS = [
  'date',
  'amount',
  'currency',
  'variableSymbol',
  'counterpartyName',
  'counterpartyAccount',
  'message',
] as const
type MapField = (typeof MAP_FIELDS)[number]
type Mapping = Partial<Record<MapField, string>>

type Account = { id: string; label: string; currency: string }

type Parsed =
  | { kind: 'ok'; statement: ParsedStatement }
  | { kind: 'needs-mapping' }
  | { kind: 'unreadable' }

/** The first non-empty line with several cells, i.e. the header of an unrecognised CSV. */
function headerOf(content: string): string[] {
  const first = content.split(/\r?\n/).find((l) => l.trim() !== '') ?? ''
  const delimiter = [';', ',', '\t'].reduce((a, b) =>
    first.split(b).length > first.split(a).length ? b : a,
  )
  return (readDelimited(first, delimiter)[0] ?? []).map((h) => h.trim()).filter(Boolean)
}

/** Reads the file in the browser so the user sees what will be imported before anything is stored. */
function tryParse(content: string, currency: string | undefined, mapping: Mapping | null): Parsed {
  const picked = mapping
    ? (Object.fromEntries(Object.entries(mapping).filter(([, v]) => v)) as Mapping)
    : undefined
  try {
    return {
      kind: 'ok',
      statement: parseStatement(content, { currency, ...(picked ? { mapping: picked } : {}) }),
    }
  } catch (e) {
    return needsMapping(e) ? { kind: 'needs-mapping' } : { kind: 'unreadable' }
  }
}

/** Czech wording for the parser's English "skipped row" warnings. */
function skippedText(warning: string): string {
  const m = /^(Row|Line|Entry) (\d+): (?:skipped \((.*)\)|(.*))$/.exec(warning)
  if (!m) return warning
  const reason = m[3] ?? m[4] ?? ''
  const why = /currency/.test(reason)
    ? t.skippedReasons.currency
    : /date or amount|amount or date|date, amount/.test(reason)
      ? t.skippedReasons.date
      : t.skippedReasons.other
  return t.skippedRow(`${t.rowWord} ${m[2]}`, why)
}

const PREVIEW_ROWS = 8

function DropZone({
  onFile,
  fileName,
}: {
  onFile: (file: File | undefined) => void
  fileName: string
}) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        onFile(e.dataTransfer.files[0])
      }}
      className={cn(
        'relative flex flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center transition-colors focus-within:ring-3 focus-within:ring-ring/50',
        over ? 'border-primary bg-primary/5' : 'border-input bg-muted/40 hover:bg-muted/70',
      )}
    >
      <FileUp className="size-6 text-muted-foreground" aria-hidden />
      <Label htmlFor="bank-upload-file" className="cursor-pointer text-sm font-medium">
        <span className="sr-only">{t.file}: </span>
        {over ? t.dropActive : fileName || t.dropTitle}
      </Label>
      <span className="text-muted-foreground text-xs">{t.dropOr}</span>
      <input
        id="bank-upload-file"
        type="file"
        accept=".csv,.txt,.gpc,.abo,.xml"
        className="absolute inset-0 size-full cursor-pointer opacity-0"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  )
}

function StatementPreview({ statement }: { statement: ParsedStatement }) {
  const rows = statement.transactions
  const outgoing = rows.filter((r) => Number(r.amount) < 0).length
  return (
    <section aria-label={t.previewTitle} className="space-y-2" data-testid="import-preview">
      <h3 className="text-sm font-medium">{t.previewTitle}</h3>
      <p className="text-muted-foreground text-xs">
        {t.previewRows(rows.length)} · {t.previewIncoming(rows.length - outgoing)} ·{' '}
        {t.previewOutgoing(outgoing)}
      </p>
      <ul className="max-h-64 divide-y overflow-auto rounded-lg border">
        {rows.slice(0, PREVIEW_ROWS).map((r, i) => {
          const debit = Number(r.amount) < 0
          return (
            <li key={i} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{r.counterpartyName ?? r.message ?? '—'}</div>
                <div className="text-muted-foreground text-xs">
                  {formatDateCs(r.bookedOn)}
                  {r.variableSymbol && ` · ${t.vs} ${r.variableSymbol}`}
                  {debit && ` · ${t.previewOutgoingHint}, ${t.previewOutgoingNote}`}
                </div>
              </div>
              <span className={cn('shrink-0 tabular-nums', debit && 'text-muted-foreground')}>
                {formatMoney(r.amount, r.currency)}
              </span>
            </li>
          )
        })}
      </ul>
      {rows.length > PREVIEW_ROWS && (
        <p className="text-muted-foreground text-xs">{t.previewMore(rows.length - PREVIEW_ROWS)}</p>
      )}
      {rows.length - outgoing > 0 && (
        <p className="text-muted-foreground text-xs">{t.previewIncomingHint}</p>
      )}
      {statement.warnings.length > 0 && (
        <div role="status" className="space-y-1 rounded-lg bg-muted px-3 py-2 text-xs">
          <p className="font-medium">{t.previewSkipped(statement.warnings.length)}</p>
          <ul className="text-muted-foreground">
            {statement.warnings.slice(0, 3).map((w) => (
              <li key={w}>{skippedText(w)}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

type ImportResult = {
  rows: {
    bookedOn: string
    amount: string
    currency: string
    counterpartyName: string | null
    variableSymbol: string | null
    outcome: 'matched' | 'suggested' | 'unmatched' | 'outgoing' | 'duplicate'
    documentNumber: string | null
  }[]
  rowsTruncated: boolean
  warnings: string[]
}

function ResultSummary({ result }: { result: ImportResult }) {
  const count = (...o: ImportResult['rows'][number]['outcome'][]) =>
    result.rows.filter((r) => o.includes(r.outcome)).length
  const groups = [
    ['matched', count('matched')],
    ['suggested', count('suggested')],
    ['unmatched', count('unmatched')],
    ['skipped', count('outgoing', 'duplicate') + result.warnings.length],
  ] as const
  const label = (r: ImportResult['rows'][number]) =>
    r.outcome === 'matched' || r.outcome === 'suggested'
      ? t.outcomes[r.outcome](r.documentNumber)
      : t.outcomes[r.outcome]
  return (
    <section aria-label={t.resultTitle} className="space-y-3" data-testid="import-result">
      <p className="text-muted-foreground text-sm">
        {t.resultRows(result.rows.length + result.warnings.length)}
      </p>
      <ul className="flex flex-wrap gap-1.5" aria-label={t.resultTitle}>
        {groups.map(([key, n]) => (
          <li
            key={key}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs tabular-nums',
              n === 0 && 'text-muted-foreground',
              key === 'matched' && n > 0 && 'border-success/40 bg-success/10',
            )}
          >
            {t.resultGroups[key]}: {n}
          </li>
        ))}
      </ul>
      <ul className="max-h-72 divide-y overflow-auto rounded-lg border">
        {result.rows.map((r, i) => (
          <li key={i} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium">{r.counterpartyName ?? '—'}</div>
              <div className="text-muted-foreground text-xs">
                {formatDateCs(r.bookedOn)}
                {r.variableSymbol && ` · ${t.vs} ${r.variableSymbol}`}
              </div>
              <div
                className={cn(
                  'text-xs',
                  r.outcome === 'matched' ? 'text-success' : 'text-muted-foreground',
                )}
              >
                {label(r)}
              </div>
            </div>
            <span className="shrink-0 tabular-nums">{formatMoney(r.amount, r.currency)}</span>
          </li>
        ))}
        {result.warnings.map((w) => (
          <li key={w} className="px-3 py-2 text-muted-foreground text-xs">
            {skippedText(w)}
          </li>
        ))}
      </ul>
      {result.rowsTruncated && <p className="text-muted-foreground text-xs">{t.resultTruncated}</p>}
    </section>
  )
}

export function UploadStatementDialog({
  open,
  onOpenChange,
  accounts,
  defaultAccountId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Account[]
  defaultAccountId?: string
}) {
  const queryClient = useQueryClient()
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? '')
  const [content, setContent] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [mapping, setMapping] = useState<Mapping | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const currency = accounts.find((a) => a.id === accountId)?.currency
  const parsed = useMemo(
    () => (content ? tryParse(content, currency, mapping) : null),
    [content, currency, mapping],
  )

  const reset = () => {
    setContent(null)
    setFileName('')
    setMapping(null)
    setError(null)
    setResult(null)
  }

  const run = useMutation(
    orpc.bank.importStatement.mutationOptions({
      onSuccess: async (r) => {
        setResult(r)
        await queryClient.invalidateQueries()
      },
      onError: (err) => {
        if (needsMapping(err)) {
          setMapping((m) => m ?? {})
          setError(null)
        } else setError(bankErrorMessage(err))
      },
    }),
  )

  const onFile = async (file: File | undefined) => {
    setError(null)
    if (!file) {
      setContent(null)
      setFileName('')
      setMapping(null)
      return
    }
    setFileName(file.name)
    // Czech banks mostly export Windows-1250; decode before the text reaches the parser.
    const text = decodeBankFile(new Uint8Array(await file.arrayBuffer()))
    setContent(text)
    setMapping(tryParse(text, currency, null).kind === 'needs-mapping' ? {} : null)
  }

  const headers = mapping && content ? headerOf(content) : []
  const submit = () => {
    if (!content || !accountId) return
    setError(null)
    const picked = mapping
      ? Object.fromEntries(Object.entries(mapping).filter(([, v]) => v))
      : undefined
    run.mutate({
      bankAccountId: accountId,
      content,
      currency,
      ...(picked ? { mapping: picked } : {}),
    })
  }

  const readable = parsed?.kind === 'ok' && parsed.statement.transactions.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-xl">
        {result ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t.resultTitle}</DialogTitle>
            </DialogHeader>
            <ResultSummary result={result} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset}>
                {t.resultAgain}
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                {t.resultDone}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <DialogHeader>
              <DialogTitle>{t.uploadTitle}</DialogTitle>
              <DialogDescription>{t.uploadHelp}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="bank-upload-account">{t.account}</Label>
              <NativeSelect
                id="bank-upload-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} ({a.currency})
                  </option>
                ))}
              </NativeSelect>
            </div>
            <DropZone onFile={onFile} fileName={fileName} />

            {parsed?.kind === 'unreadable' && (
              <p role="alert" className="text-destructive text-sm">
                {t.previewUnreadable}
              </p>
            )}
            {mapping && headers.length > 0 && (
              <fieldset className="space-y-3 rounded-lg border p-3">
                <legend className="px-1 text-sm font-medium">{t.mapTitle}</legend>
                <p className="text-muted-foreground text-sm">{t.mapHelp}</p>
                {MAP_FIELDS.map((f) => (
                  <div key={f} className="grid grid-cols-2 items-center gap-2">
                    <Label htmlFor={`map-${f}`}>{t.mapFields[f]}</Label>
                    <NativeSelect
                      id={`map-${f}`}
                      value={mapping[f] ?? ''}
                      onChange={(e) => setMapping({ ...mapping, [f]: e.target.value })}
                    >
                      <option value="">{t.noColumn}</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                ))}
              </fieldset>
            )}
            {parsed?.kind === 'ok' && <StatementPreview statement={parsed.statement} />}

            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="submit"
                disabled={!content || !accountId || run.isPending || !readable}
                title={fileName}
              >
                {run.isPending ? t.importing : t.import}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
