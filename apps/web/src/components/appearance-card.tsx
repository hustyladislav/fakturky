import { Button } from '@fakturky/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@fakturky/ui/components/card'
import { Input } from '@fakturky/ui/components/input'
import { Label } from '@fakturky/ui/components/label'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { client, orpc } from '@/lib/orpc'

const t = cs.appearance
const DEFAULT_ACCENT = '#1f4d3c'

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

function AssetRow({ kind, src }: { kind: 'logo' | 'signature'; src: string | null }) {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.appearance.key() })
  const upload = useMutation({
    mutationFn: async (file: File) =>
      client.appearance.setAsset({ kind, dataBase64: await toBase64(file) }),
    onSuccess: async () => {
      toast.success(t.saved)
      await refresh()
    },
    onError: (e) => {
      const field = (e as { data?: { fields?: string[] } }).data?.fields?.[0]
      toast.error(t.errors[field as keyof typeof t.errors] ?? cs.common.error)
    },
  })
  const remove = useMutation(
    orpc.appearance.deleteAsset.mutationOptions({
      onSuccess: async () => {
        toast.success(t.saved)
        await refresh()
      },
    }),
  )
  return (
    <div className="space-y-2">
      <Label htmlFor={`asset-${kind}`}>{t[kind]}</Label>
      <div className="flex flex-wrap items-center gap-3">
        {src ? (
          <img
            src={src}
            alt={t[kind]}
            className="h-12 max-w-40 rounded border bg-white object-contain p-1"
          />
        ) : (
          <span className="text-muted-foreground text-sm">{t.none}</span>
        )}
        <Input
          id={`asset-${kind}`}
          type="file"
          accept="image/png,image/jpeg"
          className="max-w-64"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload.mutate(f)
            e.target.value = ''
          }}
        />
        {src && (
          <Button variant="ghost" size="sm" onClick={() => remove.mutate({ kind })}>
            {t.remove}
          </Button>
        )}
      </div>
    </div>
  )
}

export function AppearanceCard() {
  const queryClient = useQueryClient()
  const q = useQuery(orpc.appearance.get.queryOptions({ input: {} }))
  const [color, setColor] = useState<string | null>(null)
  const update = useMutation(
    orpc.appearance.update.mutationOptions({
      onSuccess: async () => {
        toast.success(t.saved)
        setColor(null)
        await queryClient.invalidateQueries({ queryKey: orpc.appearance.key() })
      },
      onError: () => toast.error(cs.common.error),
    }),
  )
  const a = q.data
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="accent">{t.accent}</Label>
          <div className="flex items-center gap-2">
            <input
              id="accent"
              type="color"
              className="h-9 w-14 cursor-pointer rounded border"
              value={color ?? a?.accentColor ?? DEFAULT_ACCENT}
              onChange={(e) => setColor(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!color || update.isPending}
              onClick={() => update.mutate({ accentColor: color })}
            >
              {cs.common.save}
            </Button>
            {a?.accentColor && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => update.mutate({ accentColor: null })}
              >
                {t.resetColor}
              </Button>
            )}
          </div>
        </div>
        <AssetRow kind="logo" src={a?.logo ?? null} />
        <AssetRow kind="signature" src={a?.signature ?? null} />
        <p className="text-muted-foreground text-xs">{t.hint}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={a?.showBrand ?? true}
            disabled={!a || update.isPending}
            onChange={(e) => update.mutate({ showBrand: e.target.checked })}
          />
          {t.showBrand}
        </label>
      </CardContent>
    </Card>
  )
}
