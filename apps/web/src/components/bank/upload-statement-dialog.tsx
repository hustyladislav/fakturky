import { decodeBankFile, readDelimited } from '@fakturky/domain/bank'
import { Button } from '@fakturky/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@fakturky/ui/components/dialog'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
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

type Account = { id: string; label: string; currency: string }

/** The first non-empty line with several cells, i.e. the header of an unrecognised CSV. */
function headerOf(content: string): string[] {
  const first = content.split(/\r?\n/).find((l) => l.trim() !== '') ?? ''
  const delimiter = [';', ',', '\t'].reduce((a, b) =>
    first.split(b).length > first.split(a).length ? b : a,
  )
  return (readDelimited(first, delimiter)[0] ?? []).map((h) => h.trim()).filter(Boolean)
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
  const [mapping, setMapping] = useState<Partial<Record<MapField, string>> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setContent(null)
    setFileName('')
    setMapping(null)
    setError(null)
  }

  const run = useMutation(
    orpc.bank.importStatement.mutationOptions({
      onSuccess: async (r) => {
        toast.success(t.imported(r.imported, r.duplicates, r.autoMatched))
        if (r.warnings.length > 0) toast.message(t.skippedRows(r.warnings.length))
        await queryClient.invalidateQueries()
        reset()
        onOpenChange(false)
      },
      onError: (err) => {
        if (needsMapping(err)) {
          setMapping((m) => m ?? {})
          setError(null)
        } else setError(bankErrorMessage(err))
      },
    }),
  )

  const headers = mapping && content ? headerOf(content) : []
  const submit = () => {
    if (!content || !accountId) return
    setError(null)
    const account = accounts.find((a) => a.id === accountId)
    const picked = mapping
      ? Object.fromEntries(Object.entries(mapping).filter(([, v]) => v))
      : undefined
    run.mutate({
      bankAccountId: accountId,
      content,
      currency: account?.currency,
      ...(picked ? { mapping: picked } : {}),
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent>
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
            <select
              id="bank-upload-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} ({a.currency})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bank-upload-file">{t.file}</Label>
            <Input
              id="bank-upload-file"
              type="file"
              accept=".csv,.txt,.gpc,.abo,.xml"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                setMapping(null)
                setError(null)
                if (!file) {
                  setContent(null)
                  setFileName('')
                  return
                }
                setFileName(file.name)
                // Czech banks mostly export Windows-1250; decode before the text reaches the API.
                setContent(decodeBankFile(new Uint8Array(await file.arrayBuffer())))
              }}
            />
          </div>

          {mapping && headers.length > 0 && (
            <fieldset className="space-y-3 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">{t.mapTitle}</legend>
              <p className="text-muted-foreground text-sm">{t.mapHelp}</p>
              {MAP_FIELDS.map((f) => (
                <div key={f} className="grid grid-cols-2 items-center gap-2">
                  <Label htmlFor={`map-${f}`}>{t.mapFields[f]}</Label>
                  <select
                    id={`map-${f}`}
                    value={mapping[f] ?? ''}
                    onChange={(e) => setMapping({ ...mapping, [f]: e.target.value })}
                    className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                  >
                    <option value="">{t.noColumn}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </fieldset>
          )}

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                !content ||
                !accountId ||
                run.isPending ||
                (!!mapping && !(mapping.date && mapping.amount))
              }
              title={fileName}
            >
              {run.isPending ? t.importing : t.import}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
