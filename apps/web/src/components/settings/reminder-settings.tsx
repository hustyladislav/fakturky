import { Button } from '@fakturky/ui/components/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SettingsSection } from '@/components/settings/settings-section'
import { cs } from '@/i18n/cs'
import { client, orpc } from '@/lib/orpc'

export function DataExport() {
  return (
    <SettingsSection
      id="ucet"
      title={cs.settings.exportTitle}
      description={cs.settings.exportDescription}
      action={
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const f = await client.exports.organization({})
              const url = URL.createObjectURL(new Blob([f.json], { type: 'application/json' }))
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
          {cs.settings.exportButton}
        </Button>
      }
    />
  )
}

export function ReminderSettings() {
  const queryClient = useQueryClient()
  const profile = useQuery(orpc.businessProfile.get.queryOptions())
  const save = useMutation(
    orpc.businessProfile.update.mutationOptions({
      onSuccess: async () => {
        toast.success(cs.settings.profileSaved)
        await queryClient.invalidateQueries({ queryKey: orpc.businessProfile.key() })
      },
    }),
  )
  return (
    <SettingsSection
      id="emaily"
      title={cs.settings.remindersTitle}
      description={cs.settings.remindersDescription}
    >
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={profile.data?.autoRemind ?? false}
          disabled={!profile.data || save.isPending}
          onChange={(e) => save.mutate({ autoRemind: e.target.checked })}
        />
        {cs.settings.remindersToggle}
      </label>
    </SettingsSection>
  )
}
