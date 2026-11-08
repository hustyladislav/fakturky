import { useState } from 'react'
import { cs } from '@/i18n/cs'
import { ControlStatementSection } from './control-statement-section'
import { ReturnSection } from './return-section'
import { SummaryStatementSection } from './summary-and-guide'
import type { VatManual, VatReport } from './use-vat-report'
import { VatWarnings } from './warnings'

/** The three statements of one period, in filing order. Mount it with `key` = period to reset drill-downs. */
export function ReportBody({ report, manual }: { report: VatReport; manual: VatManual }) {
  const [open, setOpen] = useState<string | null>(null)
  const drill = { open, setOpen }
  return (
    <div className="space-y-10">
      {report.advisories.map((a) => (
        <p key={a} className="text-sm text-muted-foreground">
          {cs.vat.advisories[a] ?? a}
        </p>
      ))}
      <VatWarnings report={report} />
      <ReturnSection report={report} drill={drill} manual={manual} />
      <ControlStatementSection report={report} drill={drill} />
      <SummaryStatementSection report={report} />
    </div>
  )
}
