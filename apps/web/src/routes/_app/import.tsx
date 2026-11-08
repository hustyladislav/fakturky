import type { RouterOutputs } from '@fakturky/core/router'
import { Button } from '@fakturky/ui/components/button'
import { FilePicker } from '@fakturky/ui/components/file-picker'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { PageHeader } from '@fakturky/ui/components/page-header'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { SettingsSection } from '@/components/settings-section'
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
    <div className="hairline space-y-2 pt-4 text-sm" role="status">
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
    <SettingsSection title={t.fakturoidTitle} description={t.fakturoidDescription}>
      <div>
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
      </div>
    </SettingsSection>
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
    <SettingsSection title={t.fileTitle} description={t.fileDescription}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file-kind">{t.fileKind}</Label>
          <NativeSelect
            id="file-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as FileKind)}
          >
            <option value="invoices-csv">{t.kindInvoices}</option>
            <option value="contacts-csv">{t.kindContacts}</option>
            <option value="isdoc">{t.kindIsdoc}</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="file-input">{t.chooseFile}</Label>
          <FilePicker
            id="file-input"
            buttonLabel={cs.common.chooseFile}
            emptyLabel={cs.common.noFile}
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
      </div>
    </SettingsSection>
  )
}

function ImportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="space-y-4">
        <Link
          to="/nastaveni"
          className="inline-flex min-h-11 items-center text-muted-foreground text-sm hover:text-foreground"
        >
          ← {t.back}
        </Link>
        <PageHeader className="mb-0" title={t.title} subtitle={t.intro} />
      </div>
      <FakturoidCard />
      <FileCard />
    </div>
  )
}
