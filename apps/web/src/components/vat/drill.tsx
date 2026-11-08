import { formatDateCs } from '@fakturky/domain/dates'
import { Button } from '@fakturky/ui/components/button'
import { Money } from '@fakturky/ui/components/money'
import { Link } from '@tanstack/react-router'
import { cs } from '@/i18n/cs'
import type { VatReport } from './use-vat-report'

const t = cs.vat

/** Which report row (if any) has its documents expanded; owned by the report, passed to rows. */
export type DrillState = { open: string | null; setOpen: (key: string | null) => void }

export function DocLink({ report, id }: { report: VatReport; id: string }) {
  const d = report.documents[id]
  if (!d) return null
  return (
    <Link to="/faktury/$id" params={{ id }} className="underline">
      {d.number}
    </Link>
  )
}

/** Documents behind a row. */
export function Drill({ report, rowKey }: { report: VatReport; rowKey: string }) {
  const rows = report.contributions.filter((c) => c.rowKey === rowKey)
  return (
    <div className="border-l-2 pl-4">
      <h3 className="mb-2 text-sm font-medium">{t.drill.title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.kh.none}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <tbody>
              {rows.map((c) => {
                const d = report.documents[c.documentId]
                return (
                  <tr key={`${c.rowKey}-${c.documentId}`} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">
                      <DocLink report={report} id={c.documentId} />
                    </td>
                    <td className="py-1.5 pr-3">{d ? formatDateCs(d.taxableDate) : ''}</td>
                    <td className="py-1.5 pr-3">{d?.customerName}</td>
                    <td className="py-1.5 pr-3 text-right">
                      <Money amount={c.base} />
                    </td>
                    <td className="py-1.5 text-right">
                      <Money amount={c.vat} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function DrillButton({
  rowKey,
  count,
  drill,
}: {
  rowKey: string
  count: number
  drill: DrillState
}) {
  const isOpen = drill.open === rowKey
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-expanded={isOpen}
      disabled={count === 0}
      onClick={() => drill.setOpen(isOpen ? null : rowKey)}
    >
      {count === 0 ? '–' : t.documents(count)}
    </Button>
  )
}
