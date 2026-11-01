import { Button } from '@fakturky/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@fakturky/ui/components/card'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { client, orpc } from '@/lib/orpc'

export function DataExport() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{cs.settings.exportTitle}</CardTitle>
        <CardDescription>{cs.settings.exportDescription}</CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
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
      onError: () => toast.error(cs.common.error),
    }),
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>{cs.settings.remindersTitle}</CardTitle>
        <CardDescription>{cs.settings.remindersDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={profile.data?.autoRemind ?? false}
            disabled={!profile.data || save.isPending}
            onChange={(e) => save.mutate({ autoRemind: e.target.checked })}
          />
          {cs.settings.remindersToggle}
        </label>
      </CardContent>
    </Card>
  )
}
