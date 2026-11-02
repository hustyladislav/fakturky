import { useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { navItems } from './nav'

const RECENT_KEY = 'recent-pages'

export function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
  } catch {
    return []
  }
}

/** Records visited app pages for the "Nedávné" group. */
export function useRecordRecent() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (!navItems.some((n) => n.to === pathname)) return
    try {
      const next = [pathname, ...readRecent().filter((p) => p !== pathname)].slice(0, 5)
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {}
  }, [pathname])
}
