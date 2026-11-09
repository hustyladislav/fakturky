import { Amount } from '@fakturky/ui/components/amount'
import { Avatar } from '@fakturky/ui/components/avatar'
import { Button } from '@fakturky/ui/components/button'
import { CurrencyCombobox } from '@fakturky/ui/components/currency-combobox'
import { DatePicker } from '@fakturky/ui/components/date-picker'
import { EmptyState } from '@fakturky/ui/components/empty-state'
import { PageHeader, PageTabs, SectionLabel } from '@fakturky/ui/components/page-header'
import { RelativeDate } from '@fakturky/ui/components/relative-date'
import { Skeleton } from '@fakturky/ui/components/skeleton'
import { StatusBadge } from '@fakturky/ui/components/status-badge'
import { addDays, toIsoDate } from '@fakturky/ui/lib/dates'
import { cn } from '@fakturky/ui/lib/utils'
import { Plus } from 'lucide-react'
import { useState } from 'react'

const names = [
  'Studio Lípa s.r.o.',
  'Technologie Morava a.s.',
  'Marie Svobodová',
  'Jan Novák',
  'Kavárna Dvě Věže',
  'Petr Dvořák',
  'Nadace Zelená cesta z.s.',
  'Ateliér Čtyři',
]

function Panel({ dark }: { dark?: boolean }) {
  const [tab, setTab] = useState('all')
  const [date, setDate] = useState(toIsoDate(addDays(new Date(), 14)))
  const [currency, setCurrency] = useState('CZK')
  const today = new Date()
  return (
    <div
      className={cn('min-w-0 flex-1 bg-background p-6 text-foreground sm:p-8', dark && 'dark')}
      style={{ backgroundImage: 'var(--grain)' }}
    >
      <p className="label-caps mb-6">
        {dark ? 'Tmavý režim' : 'Světlý režim'} · tokens: desk / sheet / popover
      </p>

      <PageHeader
        title="Faktury"
        subtitle="32 dokladů · 94 985 Kč neuhrazeno"
        actions={
          <Button>
            <Plus data-icon="inline-start" />
            Nová faktura
          </Button>
        }
        tabs={
          <PageTabs
            value={tab}
            onValueChange={setTab}
            items={[
              { id: 'all', label: 'Vše', count: 32 },
              { id: 'draft', label: 'Koncepty', count: 2 },
              { id: 'unpaid', label: 'Neuhrazené', count: 5 },
              { id: 'overdue', label: 'Po splatnosti', count: 7 },
            ]}
          />
        }
      />

      <div className="sheet space-y-8 p-6">
        <section className="space-y-3">
          <SectionLabel>Amount</SectionLabel>
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <div className="label-caps mb-1">Neuhrazeno</div>
              <Amount value="94985.00" size="hero" />
            </div>
            <div>
              <div className="label-caps mb-1">Po splatnosti</div>
              <Amount value="68970.50" size="lg" tone="overdue" />
            </div>
            <div>
              <div className="label-caps mb-1">Dobropis</div>
              <Amount value="-31700.00" size="lg" />
            </div>
            <div>
              <div className="label-caps mb-1">EUR</div>
              <Amount value="1250.40" currency="EUR" size="md" />
            </div>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <Amount value="26015.00" />
            <Amount value="-64372.00" />
            <Amount value="4776.48" tone="muted" />
            <Amount value="26015.00" hideZeroFraction />
          </div>
        </section>

        <section className="space-y-3">
          <SectionLabel>Avatar</SectionLabel>
          <div className="flex flex-wrap items-center gap-3">
            {names.map((n) => (
              <div key={n} className="flex items-center gap-2 text-sm">
                <Avatar name={n} />
                {n}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Avatar name="Studio Lípa" size="xs" />
            <Avatar name="Studio Lípa" size="sm" />
            <Avatar name="Studio Lípa" size="md" />
            <Avatar name="Studio Lípa" size="lg" />
            <Avatar name="Studio Lípa" size="xl" shape="square" />
          </div>
        </section>

        <section className="space-y-3">
          <SectionLabel>StatusBadge</SectionLabel>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="draft">Koncept</StatusBadge>
            <StatusBadge status="issued">Vystavená</StatusBadge>
            <StatusBadge status="overdue">Po splatnosti</StatusBadge>
            <StatusBadge status="overdue" overdueDays={14} />
            <StatusBadge status="overdue" overdueDays={3} />
            <StatusBadge status="partial">Částečně</StatusBadge>
            <StatusBadge status="paid">Zaplacená</StatusBadge>
            <StatusBadge status="cancelled">Stornovaná</StatusBadge>
          </div>
        </section>

        <section className="space-y-3">
          <SectionLabel>RelativeDate</SectionLabel>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {[-86, -14, -3, -1, 0, 1, 5, 30, 120].map((d) => (
              <RelativeDate
                key={d}
                date={toIsoDate(addDays(today, d))}
                tone={d < 0 ? 'due' : 'default'}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <SectionLabel>Inputs</SectionLabel>
          <div className="grid max-w-xl gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="label-caps">Datum splatnosti</div>
              <DatePicker value={date} onChange={setDate} presets presetBase={toIsoDate(today)} />
            </div>
            <div className="space-y-1.5">
              <div className="label-caps">Měna</div>
              <CurrencyCombobox value={currency} onChange={setCurrency} />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <SectionLabel>Skeleton</SectionLabel>
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </section>

        <section className="space-y-3">
          <SectionLabel>Typografie</SectionLabel>
          <p className="label-caps">Datum vystavení</p>
          <p className="text-sm">28. 10. 2026</p>
          <div className="hairline" />
        </section>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <EmptyState
          illustration="invoices"
          title="Zatím žádné faktury"
          action={<Button>Vystavit první fakturu</Button>}
        >
          Vystavte první fakturu a QR platba se přidá sama.
        </EmptyState>
        <EmptyState illustration="contacts" title="Žádné kontakty">
          Odběratele přidáte při první faktuře nebo z ARES.
        </EmptyState>
        <EmptyState illustration="bank" title="Banka není připojená">
          Nahrajte výpis a platby se spárují s fakturami.
        </EmptyState>
        <EmptyState illustration="templates" title="Žádné šablony">
          Opakující se faktury si uložte jako šablonu.
        </EmptyState>
        <EmptyState illustration="search" title="Nic jsme nenašli">
          Zkuste jiný výraz nebo zrušte filtry.
        </EmptyState>
      </div>
    </div>
  )
}

/** Dev-only review page: every design-v2 primitive, light next to dark. */
export function UiGallery() {
  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <Panel />
      <Panel dark />
    </div>
  )
}
