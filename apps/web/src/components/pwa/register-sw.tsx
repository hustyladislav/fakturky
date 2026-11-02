import { useEffect } from 'react'
import { captureInstallPrompt } from './install-prompt'

/** Registers the static-asset service worker in production builds only. */
export function RegisterServiceWorker() {
  useEffect(() => {
    captureInstallPrompt()
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    const register = () => void navigator.serviceWorker.register('/sw.js').catch(() => {})
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])
  return null
}
