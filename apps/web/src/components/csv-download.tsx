import { Button } from '@fakturky/ui/components/button'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { client } from '@/lib/orpc'

/** Fetches a CSV through the router and saves it as a file. */
export function CsvDownload({ kind }: { kind: 'documents' | 'contacts' }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          const f = await client.exports[kind]({})
          const url = URL.createObjectURL(new Blob([f.csv], { type: 'text/csv;charset=utf-8' }))
          const a = document.createElement('a')
          a.href = url
          a.download = f.filename
          a.click()
          URL.revokeObjectURL(url)
        } catch {
          toast.error(cs.common.error)
        }
      }}
    >
      <Download /> {cs.common.exportCsv}
    </Button>
  )
}
