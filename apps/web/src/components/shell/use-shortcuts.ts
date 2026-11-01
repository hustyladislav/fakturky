import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { NEW_INVOICE_PATH, navItems } from './nav'
import { useShell } from './shell-context'

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/** N, /, ?, G+P/F/K/N, ⌘K, ⌘J. Ignored while typing in a field. */
export function useShortcuts() {
  const navigate = useNavigate()
  const shell = useShell()

  useEffect(() => {
    let goPending: ReturnType<typeof setTimeout> | null = null
    const clearGo = () => {
      if (goPending) clearTimeout(goPending)
      goPending = null
    }

    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        shell.setPaletteOpen(!shell.paletteOpen)
        return
      }
      if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        shell.setAssistantOpen(!shell.assistantOpen)
        return
      }
      if (mod || e.altKey || isTyping(e.target) || shell.paletteOpen) return

      const key = e.key.toLowerCase()
      if (goPending) {
        const target = navItems.find((n) => n.goKey === key)
        clearGo()
        if (target) {
          e.preventDefault()
          void navigate({ to: target.to })
        }
        return
      }
      if (key === 'g') {
        goPending = setTimeout(clearGo, 1200)
      } else if (key === 'n') {
        e.preventDefault()
        void navigate({ to: NEW_INVOICE_PATH as never })
      } else if (key === '/') {
        e.preventDefault()
        shell.setPaletteOpen(true)
      } else if (e.key === '?') {
        e.preventDefault()
        shell.setHelpOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearGo()
      window.removeEventListener('keydown', onKey)
    }
  }, [navigate, shell])
}
