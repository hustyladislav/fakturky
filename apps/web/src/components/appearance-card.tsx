import { Button } from '@fakturky/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@fakturky/ui/components/card'
import { FilePicker } from '@fakturky/ui/components/file-picker'
import { Label } from '@fakturky/ui/components/label'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cs } from '@/i18n/cs'
import { client, orpc } from '@/lib/orpc'
import { AppearancePreview } from './appearance-preview'

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

function AssetRow({
  kind,
  src,
  onSaved,
}: {
  kind: 'logo' | 'signature'
  src: string | null
  onSaved: () => void
}) {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.appearance.key() })
  const upload = useMutation({
    mutationFn: async (file: File) =>
      client.appearance.setAsset({ kind, dataBase64: await toBase64(file) }),
    onSuccess: async () => {
      await refresh()
      onSaved()
    },
    onError: (e) => {
      const field = (e as { data?: { fields?: string[] } }).data?.fields?.[0]
      toast.error(t.errors[field as keyof typeof t.errors] ?? cs.common.error)
    },
  })
  const remove = useMutation(
    orpc.appearance.deleteAsset.mutationOptions({
      onSuccess: async () => {
        await refresh()
        onSaved()
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
        <FilePicker
          id={`asset-${kind}`}
          buttonLabel={cs.common.chooseFile}
          emptyLabel={cs.common.noFile}
          accept="image/png,image/jpeg"
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
  const profile = useQuery(orpc.businessProfile.get.queryOptions({ input: {} }))
  // The colour being dragged in the picker; saved a moment after the last change, like everything else here.
  const [color, setColor] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(savedTimer.current), [])
  const flashSaved = () => {
    setSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 3000)
  }
  const update = useMutation(
    orpc.appearance.update.mutationOptions({
      onSuccess: async (_, v) => {
        await queryClient.invalidateQueries({ queryKey: orpc.appearance.key() })
        if (v.accentColor !== undefined) setColor((c) => (c === v.accentColor ? null : c))
        flashSaved()
      },
      onError: () => toast.error(cs.common.error),
    }),
  )
  const a = q.data
  const accent = color ?? a?.accentColor ?? DEFAULT_ACCENT

  const { mutate } = update
  useEffect(() => {
    if (color === null || color === a?.accentColor) return
    const h = setTimeout(() => mutate({ accentColor: color }), 600)
    return () => clearTimeout(h)
  }, [color, a?.accentColor, mutate])

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          {t.title}
        </CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <div className="order-2 space-y-4 lg:order-1">
          <div className="space-y-2">
            <Label htmlFor="accent">{t.accent}</Label>
            <div className="flex items-center gap-2">
              <input
                id="accent"
                type="color"
                className="h-9 w-14 cursor-pointer rounded border"
                value={accent}
                onChange={(e) => setColor(e.target.value)}
              />
              {(a?.accentColor || color) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setColor(null)
                    update.mutate({ accentColor: null })
                  }}
                >
                  {t.resetColor}
                </Button>
              )}
            </div>
          </div>
          <AssetRow kind="logo" src={a?.logo ?? null} onSaved={flashSaved} />
          <AssetRow kind="signature" src={a?.signature ?? null} onSaved={flashSaved} />
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
          <p
            className="flex min-h-5 items-center gap-1.5 text-muted-foreground text-xs"
            role="status"
          >
            {update.isPending ? (
              t.saving
            ) : saved ? (
              <>
                <Check className="size-3.5 text-success" aria-hidden /> {t.savedInline}
              </>
            ) : (
              t.autoSaves
            )}
          </p>
        </div>
        <div className="order-1 space-y-3 lg:sticky lg:top-20 lg:order-2 lg:self-start">
          <AppearancePreview
            accent={accent}
            logo={a?.logo ?? null}
            signature={a?.signature ?? null}
            showBrand={a?.showBrand ?? true}
            profile={profile.data}
          />
          <p className="text-muted-foreground text-xs">{t.issuedKeep}</p>
        </div>
      </CardContent>
    </Card>
  )
}
