import { useEffect, useState } from 'react'

/** SSR-stable: starts as "Ctrl" and switches to "⌘" after mount on Apple platforms. */
export function useModKey() {
  const [key, setKey] = useState('Ctrl')
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setKey('⌘')
  }, [])
  return key
}
