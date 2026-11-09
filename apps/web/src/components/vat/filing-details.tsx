import { Button } from '@fakturky/ui/components/button'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { NativeSelect } from '@fakturky/ui/components/native-select'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { SettingsSection } from '@/components/settings-section'
import { cs } from '@/i18n/cs'
import { apiErrorMessage } from '@/lib/errors'
import { orpc } from '@/lib/orpc'
import type { VatProfile } from './use-vat-report'

const t = cs.vat

/** Tax office, subject type and period: what EPO needs besides the figures. */
export function FilingDetails({ profile }: { profile: VatProfile }) {
  const queryClient = useQueryClient()
  const f = profile.vatFiling
  const [editing, setEditing] = useState(false)
  const [taxOfficeCode, setCode] = useState(f?.taxOfficeCode ?? '')
  const [workplaceCode, setWorkplace] = useState(f?.workplaceCode ?? '')
  const [subjectType, setType] = useState<'F' | 'P'>(f?.subjectType ?? 'F')
  const [period, setPeriodKind] = useState<'monthly' | 'quarterly'>(f?.period ?? 'monthly')
  const [error, setError] = useState<string | null>(null)
  const save = useMutation(
    orpc.businessProfile.update.mutationOptions({
      onSuccess: async () => {
        toast.success(t.filing.saved)
        setEditing(false)
        await queryClient.invalidateQueries({ queryKey: orpc.businessProfile.key() })
        await queryClient.invalidateQueries({ queryKey: orpc.vat.key() })
      },
      onError: (e) => toast.error(apiErrorMessage(e)),
    }),
  )
  const complete = Boolean(f) && Boolean(profile.dic)
  const show = editing || !complete

  return (
    <SettingsSection
      title={t.filing.title}
      action={
        complete && !editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            {t.filing.edit}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {!profile.dic && (
          <p className="text-sm text-destructive">
            {t.filing.missingDic}{' '}
            <Link to="/nastaveni" className="underline">
              {t.filing.profileLink}
            </Link>
          </p>
        )}
        {!f && <p className="text-sm text-muted-foreground">{t.filing.missingFiling}</p>}
        {complete && !editing && f && (
          <p className="text-sm text-muted-foreground">
            {profile.dic} · {t.filing.taxOfficeCode}: {f.taxOfficeCode}
            {f.workplaceCode ? `/${f.workplaceCode}` : ''} ·{' '}
            {f.subjectType === 'F' ? t.filing.personF : t.filing.personP} ·{' '}
            {f.period === 'monthly' ? t.monthly : t.quarterly}
          </p>
        )}
        {show && (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!/^\d{3}$/.test(taxOfficeCode)) {
                setError(t.filing.invalidCode)
                return
              }
              setError(null)
              save.mutate({
                vatFiling: {
                  taxOfficeCode,
                  workplaceCode: workplaceCode || null,
                  period,
                  subjectType,
                },
              })
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="uf-code">{t.filing.taxOfficeCode}</Label>
              <Input
                id="uf-code"
                inputMode="numeric"
                maxLength={3}
                value={taxOfficeCode}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                aria-describedby="uf-hint"
              />
              <p id="uf-hint" className="text-xs text-muted-foreground">
                {error ?? t.filing.taxOfficeHint}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="uf-work">{t.filing.workplaceCode}</Label>
              <Input
                id="uf-work"
                inputMode="numeric"
                maxLength={4}
                value={workplaceCode}
                onChange={(e) => setWorkplace(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uf-type">{t.filing.subjectType}</Label>
              <NativeSelect
                id="uf-type"
                value={subjectType}
                onChange={(e) => setType(e.target.value as 'F' | 'P')}
              >
                <option value="F">{t.filing.personF}</option>
                <option value="P">{t.filing.personP}</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="uf-period">{t.filing.periodLabel}</Label>
              <NativeSelect
                id="uf-period"
                value={period}
                onChange={(e) => setPeriodKind(e.target.value as 'monthly' | 'quarterly')}
              >
                <option value="monthly">{t.monthly}</option>
                <option value="quarterly">{t.quarterly}</option>
              </NativeSelect>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={save.isPending}>
                {t.filing.save}
              </Button>
            </div>
          </form>
        )}
      </div>
    </SettingsSection>
  )
}
