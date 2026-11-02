import type { RouterOutputs } from '@fakturky/core/router'
import { Button } from '@fakturky/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@fakturky/ui/components/card'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { cs } from '@/i18n/cs'
import { orpc } from '@/lib/orpc'

export const Route = createFileRoute('/_app/import')({ component: ImportPage })

const t = cs.import
type Summary = RouterOutputs['import']['file']

const levelLabel = { skipped: t.levelSkipped, failed: t.levelFailed, warning: t.levelWarning }

function Result({ summary }: { summary: Summary }) {
  const row = (label: string, v: { created: number; skipped: number; failed?: number }) => (
    <p>
      <span className="font-medium">{label}:</span> {v.created} {t.created}, {v.skipped} {t.skipped}
      {v.failed ? `, ${v.failed} ${t.failedCount}` : ''}
    </p>
  )
  return (
    <div className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm" role="status">
      <p className="font-medium">{summary.dryRun ? t.resultPreview : t.resultDone}</p>
      {row(t.contacts, summary.contacts)}
      {row(t.documents, summary.documents)}
      {summary.numberingAdjusted > 0 && (
        <p>
          <span className="font-medium">{t.numbering}:</span> {summary.numberingAdjusted}
        </p>
      )}
      {summary.issues.length > 0 && (
        <div>
          <p className="font-medium">{t.issues}</p>
          <ul className="max-h-60 list-disc space-y-0.5 overflow-auto pl-5 text-muted-foreground">
            {summary.issues.slice(0, 100).map((i) => (
              <li key={`${i.kind}-${i.ref}-${i.level}-${i.message}`}>
                {i.ref} — {levelLabel[i.level]}: {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function useImportMutation<T extends 'fakturoid' | 'file'>(kind: T) {
  const queryClient = useQueryClient()
  const options = orpc.import[kind].mutationOptions({
    onSuccess: async () => {
      await queryClient.invalidateQueries()
    },
  })
  // Both procedures share the summary output type.
  return useMutation(options as any) as ReturnType<typeof useMutation<Summary, Error, any>>
}

function FakturoidCard() {
  const mutation = useImportMutation('fakturoid')
  const [summary, setSummary] = useState<Summary | null>(null)
  const submit = (form: HTMLFormElement, dryRun: boolean) => {
    const data = new FormData(form)
    setSummary(null)
    mutation.mutate(
      {
        accountSlug: String(data.get('accountSlug') ?? ''),
        clientId: String(data.get('clientId') ?? ''),
        clientSecret: String(data.get('clientSecret') ?? ''),
        dryRun,
      },
      { onSuccess: setSummary },
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.fakturoidTitle}</CardTitle>
        <CardDescription>{t.fakturoidDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault()
            submit(e.currentTarget, false)
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="accountSlug">{t.accountSlug}</Label>
            <Input id="accountSlug" name="accountSlug" required autoComplete="off" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clientId">{t.clientId}</Label>
              <Input id="clientId" name="clientId" required autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientSecret">{t.clientSecret}</Label>
              <Input
                id="clientSecret"
                name="clientSecret"
                type="password"
                required
                autoComplete="new-password"
              />
            </div>
          </div>
          {mutation.isError && <p className="text-destructive text-sm">{t.failed}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t.running : t.run}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={(e) => {
                const form = e.currentTarget.form
                if (form?.reportValidity()) submit(form, true)
              }}
            >
              {t.preview}
            </Button>
          </div>
        </form>
        {summary && (
          <div className="mt-4">
            <Result summary={summary} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

type FileKind = 'contacts-csv' | 'invoices-csv' | 'isdoc'

function FileCard() {
  const mutation = useImportMutation('file')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [kind, setKind] = useState<FileKind>('invoices-csv')
  const [file, setFile] = useState<File | null>(null)

  const run = async (dryRun: boolean) => {
    if (!file) return
    setSummary(null)
    mutation.mutate(
      {
        format: kind === 'isdoc' ? 'isdoc' : 'csv',
        kind: kind === 'contacts-csv' ? 'contacts' : 'invoices',
        content: await file.text(),
        dryRun,
      },
      { onSuccess: setSummary },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.fileTitle}</CardTitle>
        <CardDescription>{t.fileDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file-kind">{t.fileKind}</Label>
          <select
            id="file-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as FileKind)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="invoices-csv">{t.kindInvoices}</option>
            <option value="contacts-csv">{t.kindContacts}</option>
            <option value="isdoc">{t.kindIsdoc}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="file-input">{t.chooseFile}</Label>
          <Input
            id="file-input"
            type="file"
            accept=".csv,.txt,.xml,.isdoc"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        {mutation.isError && <p className="text-destructive text-sm">{t.failed}</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!file || mutation.isPending} onClick={() => run(false)}>
            {mutation.isPending ? t.running : t.run}
          </Button>
          <Button
            variant="outline"
            disabled={!file || mutation.isPending}
            onClick={() => run(true)}
          >
            {t.preview}
          </Button>
        </div>
        {summary && <Result summary={summary} />}
      </CardContent>
    </Card>
  )
}

function ImportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/nastaveni" className="text-muted-foreground text-sm hover:underline">
        ← {t.back}
      </Link>
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <p className="text-muted-foreground text-sm">{t.intro}</p>
      <FakturoidCard />
      <FileCard />
    </div>
  )
}
