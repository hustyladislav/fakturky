import { Button } from '@fakturky/ui/components/button'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { client } from '@/lib/orpc'
import type { VatReport, VatReportInput } from './use-vat-report'

const t = cs.vat.downloads

function downloadXml(f: { filename: string; xml: string }) {
  const url = URL.createObjectURL(new Blob([f.xml], { type: 'application/xml;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = f.filename
  a.click()
  URL.revokeObjectURL(url)
}

/** The three EPO files for the chosen period, directly under the period picker. */
export function VatExports({
  input,
  report,
}: {
  input: VatReportInput
  report: VatReport | undefined
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const get = async (kind: 'dp3' | 'kh' | 'sh') => {
    setBusy(kind)
    try {
      downloadXml(await client.vat.exportXml({ ...input, kind }))
    } catch (e) {
      toast.error((e as Error).message || t.error)
    } finally {
      setBusy(null)
    }
  }
  const ready = report?.filing.ready === true
  return (
    <div role="group" aria-label={t.title} className="space-y-3">
      <div>
        <h2 className="text-xl leading-7">{t.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(['dp3', 'kh', 'sh'] as const).map((kind) => (
          <Button
            key={kind}
            variant={kind === 'dp3' ? 'default' : 'outline'}
            disabled={!ready || busy !== null}
            onClick={() => get(kind)}
          >
            <Download aria-hidden /> {t[kind]}
          </Button>
        ))}
      </div>
      {report && !ready && <p className="text-sm text-muted-foreground">{t.needFiling}</p>}
    </div>
  )
}
