import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@fakturky/ui/components/dialog'
import { Kbd } from '@fakturky/ui/components/kbd'
import { cs } from '@/i18n/cs'
import { useShell } from './shell-context'

import { useModKey } from './use-mod-key'

export function ShortcutsHelp() {
  const { helpOpen, setHelpOpen } = useShell()
  const modKey = useModKey()
  const rows: { keys: string[]; label: string }[] = [
    { keys: [modKey, 'K'], label: cs.shortcuts.palette },
    { keys: ['/'], label: cs.shortcuts.search },
    { keys: ['N'], label: cs.shortcuts.newInvoice },
    { keys: ['G', 'P'], label: cs.shortcuts.goOverview },
    { keys: ['G', 'F'], label: cs.shortcuts.goInvoices },
    { keys: ['G', 'K'], label: cs.shortcuts.goContacts },
    { keys: ['G', 'N'], label: cs.shortcuts.goSettings },
    { keys: [modKey, 'J'], label: cs.shortcuts.assistant },
    { keys: [modKey, '\\'], label: cs.shortcuts.sidebar },
    { keys: ['?'], label: cs.shortcuts.help },
  ]
  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-w-md" closeLabel={cs.common.close}>
        <DialogHeader>
          <DialogTitle>{cs.shortcuts.title}</DialogTitle>
        </DialogHeader>
        <ul className="divide-y text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between py-2">
              <span>{r.label}</span>
              <span className="flex gap-1">
                {r.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
