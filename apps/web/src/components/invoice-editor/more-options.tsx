import type { DocumentLanguage } from '@fakturky/domain'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@fakturky/ui/components/collapsible'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { Textarea } from '@fakturky/ui/components/textarea'
import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cs } from '@/i18n/cs'
import { opensMoreOptions } from './opens-more-options'
import type { InvoiceDraft } from './use-invoice-draft'

const t = cs.invoices.form

/** Texts, order number, language: out of the way until needed (open by itself for a draft that uses them). */
export function MoreOptions({ draft, isEdit }: { draft: InvoiceDraft; isEdit: boolean }) {
  const { fields, set, ready } = draft
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (ready && opensMoreOptions(isEdit, fields)) setOpen(true)
  }, [ready])
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t">
      <CollapsibleTrigger className="group -mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 py-4 text-left outline-none focus-visible:bg-muted/50 pointer-coarse:min-h-11">
        <span>
          <span className="block text-sm">{t.moreOptions}</span>
          <span className="block text-muted-foreground text-xs">{t.moreOptionsHint}</span>
        </span>
        <ChevronDown
          aria-hidden
          className="size-4 text-muted-foreground transition-transform group-aria-expanded:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pb-6">
        <div className="space-y-1.5">
          <Label htmlFor="intro">{t.intro}</Label>
          <Textarea
            id="intro"
            rows={2}
            value={fields.introText}
            onChange={(e) => set({ introText: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="footer">{t.footer}</Label>
          <Textarea
            id="footer"
            rows={2}
            value={fields.footerText}
            onChange={(e) => set({ footerText: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="private">{t.privateNote}</Label>
          <Textarea
            id="private"
            rows={2}
            value={fields.privateNote}
            onChange={(e) => set({ privateNote: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="order">{t.orderNumber}</Label>
            <Input
              id="order"
              enterKeyHint="done"
              value={fields.orderNumber}
              onChange={(e) => set({ orderNumber: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="language">{t.language}</Label>
            <NativeSelect
              id="language"
              value={fields.language}
              onChange={(e) => set({ language: e.target.value as DocumentLanguage })}
            >
              {Object.entries(t.languages).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
