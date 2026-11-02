import { useSyncExternalStore } from 'react'

export type InstallPromptEvent = Event & { prompt: () => Promise<void> }

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
let started = false

/** Called once from the root: `beforeinstallprompt` fires early and is not replayed, so it must be caught there. */
export function captureInstallPrompt() {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    for (const l of listeners) l()
  })
}

export function useInstallPrompt() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => deferred,
    () => null,
  )
}
