import { useEffect, useRef, useState } from 'react'

/**
 * A search box mirrored into the URL, debounced. The URL can change without typing (back button,
 * palette); the box then follows it instead of writing the old term back. `commit` must be stable.
 */
export function useUrlSearchTerm(
  q: string | undefined,
  commit: (q: string | undefined) => void,
): [term: string, setTerm: (term: string) => void] {
  const [term, setTerm] = useState(q ?? '')
  const lastSent = useRef(q ?? '')
  useEffect(() => {
    if ((q ?? '') === lastSent.current) return
    lastSent.current = q ?? ''
    setTerm(q ?? '')
  }, [q])
  useEffect(() => {
    if ((q ?? '') === term) return
    const h = setTimeout(() => {
      lastSent.current = term
      commit(term || undefined)
    }, 250)
    return () => clearTimeout(h)
  }, [term, q, commit])
  return [term, setTerm]
}
