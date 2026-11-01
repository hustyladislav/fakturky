import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './button'

export type ThemePreference = 'system' | 'light' | 'dark'
const KEY = 'theme'

/** Inline script for <head>: applies the stored theme before first paint (no flash). */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${KEY}');var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`

function apply(pref: ThemePreference) {
  const dark =
    pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

const order: ThemePreference[] = ['system', 'light', 'dark']
const icons = { system: Monitor, light: Sun, dark: Moon }

function ThemeToggle({ labels }: { labels: Record<ThemePreference, string> }) {
  const [pref, setPref] = useState<ThemePreference>('system')

  useEffect(() => {
    const stored = localStorage.getItem(KEY)
    if (stored === 'light' || stored === 'dark') setPref(stored)
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (!localStorage.getItem(KEY) || localStorage.getItem(KEY) === 'system') apply('system')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const Icon = icons[pref]
  const next = order[(order.indexOf(pref) + 1) % order.length] as ThemePreference
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={labels[next]}
      title={labels[next]}
      onClick={() => {
        localStorage.setItem(KEY, next)
        setPref(next)
        apply(next)
      }}
    >
      <Icon />
    </Button>
  )
}

export { ThemeToggle }
