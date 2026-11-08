import { Button } from '@fakturky/ui/components/button'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { client } from '@/lib/orpc'

type DocumentScope = {
  from?: string
  to?: string
  type?: 'invoice' | 'proforma' | 'credit_note' | 'payment_receipt'
}

/** Fetches a CSV through the router and saves it as a file. Documents can be narrowed to what the list shows. */
export function CsvDownload(
  props: { kind: 'contacts' } | ({ kind: 'documents' } & { scope?: DocumentScope }),
) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          const f =
            props.kind === 'documents'
              ? await client.exports.documents(props.scope ?? {})
              : await client.exports.contacts({})
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
