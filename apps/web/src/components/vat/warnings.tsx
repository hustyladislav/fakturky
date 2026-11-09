import { cn } from '@fakturky/ui/lib/utils'
import { TriangleAlert } from 'lucide-react'
import { SettingsSection } from '@/components/settings/settings-section'
import { cs } from '@/i18n/cs'
import { DocLink } from './drill'
import type { VatReport } from './use-vat-report'

const t = cs.vat.warnings

/** Documents that need a look before filing; blocking ones are named as such, never colour alone. */
export function VatWarnings({ report }: { report: VatReport }) {
  if (report.warnings.length === 0) return null
  return (
    <SettingsSection title={t.title}>
      <ul className="divide-y border-y text-sm">
        {report.warnings.map((w) => (
          <li key={`${w.code}-${w.documentId}`} className="flex items-start gap-3 py-3">
            <TriangleAlert
              className={cn(
                'mt-0.5 size-4 shrink-0',
                w.blocking ? 'text-destructive' : 'text-warning',
              )}
              aria-hidden
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="tabular-nums">
                  <DocLink report={report} id={w.documentId} />
                </span>
                <span
                  className={cn(
                    'text-xs',
                    w.blocking ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {w.blocking ? t.blocking : t.info}
                </span>
              </div>
              <p className="mt-0.5 text-muted-foreground">{t.codes[w.code] ?? w.code}</p>
            </div>
          </li>
        ))}
      </ul>
    </SettingsSection>
  )
}
