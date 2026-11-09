import { Button } from '@fakturky/ui/components/button'
import { Label } from '@fakturky/ui/components/label'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { RowList, SettingsRow, SettingsSection } from '@/components/settings/settings-section'
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
  const fileInput = useRef<HTMLInputElement>(null)
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
    <SettingsRow label={<Label htmlFor={`asset-${kind}`}>{t[kind]}</Label>}>
      {src ? (
        <img
          src={src}
          alt={t[kind]}
          className="h-10 max-w-32 rounded border bg-white object-contain p-1"
        />
      ) : (
        <span className="text-muted-foreground text-sm">{t.none}</span>
      )}
      <input
        ref={fileInput}
        id={`asset-${kind}`}
        type="file"
        className="sr-only"
        tabIndex={-1}
        accept="image/png,image/jpeg"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) upload.mutate(f)
          e.target.value = ''
        }}
      />
      <Button
        type="button"
        variant="outline"
        aria-label={`${cs.common.chooseFile}: ${t[kind]}`}
        onClick={() => fileInput.current?.click()}
      >
        {cs.common.chooseFile}
      </Button>
      {src && (
        <Button variant="ghost" size="sm" onClick={() => remove.mutate({ kind })}>
          {t.remove}
        </Button>
      )}
    </SettingsRow>
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
    <SettingsSection id="vzhled" title={t.title} description={t.description}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 space-y-4">
          <RowList>
            <SettingsRow label={<Label htmlFor="accent">{t.accent}</Label>}>
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
            </SettingsRow>
            <AssetRow kind="logo" src={a?.logo ?? null} onSaved={flashSaved} />
            <AssetRow kind="signature" src={a?.signature ?? null} onSaved={flashSaved} />
            <SettingsRow label={<Label htmlFor="show-brand">{t.showBrand}</Label>}>
              <input
                id="show-brand"
                type="checkbox"
                className="size-4"
                checked={a?.showBrand ?? true}
                disabled={!a || update.isPending}
                onChange={(e) => update.mutate({ showBrand: e.target.checked })}
              />
            </SettingsRow>
          </RowList>
          <p className="text-muted-foreground text-xs">{t.hint}</p>
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
        <div className="min-w-0 space-y-3 lg:sticky lg:top-20 lg:self-start">
          <AppearancePreview
            accent={accent}
            logo={a?.logo ?? null}
            signature={a?.signature ?? null}
            showBrand={a?.showBrand ?? true}
            profile={profile.data}
          />
          <p className="text-muted-foreground text-xs">{t.issuedKeep}</p>
        </div>
      </div>
    </SettingsSection>
  )
}
