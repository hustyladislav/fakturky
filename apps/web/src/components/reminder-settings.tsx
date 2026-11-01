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
import { orpc } from '@/lib/orpc'

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
