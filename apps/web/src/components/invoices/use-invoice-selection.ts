import { Decimal } from '@fakturky/domain/money'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { czkTotal } from '@/components/invoices/invoice-groups'
import { type Doc, docPath } from './invoice-rows'

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) &&
    !(target instanceof HTMLInputElement && target.type === 'checkbox')
  )
}

/**
 * Bulk selection plus the keyboard cursor (j/k move, Enter open, x select, Esc clear).
 * Both reset whenever `resetKey` changes (a new filter, search or sort).
 */
export function useInvoiceSelection(rows: Doc[], resetKey: string) {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [cursor, setCursor] = useState(-1)
  useEffect(() => {
    setSelected(new Set())
    setCursor(-1)
  }, [resetKey])

  const toggle = useCallback(
    (id: string) =>
      setSelected((s) => {
        const n = new Set(s)
        if (!n.delete(id)) n.add(id)
        return n
      }),
    [],
  )
  const clear = useCallback(() => setSelected(new Set()), [])

  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (document.querySelector('[role=dialog]')) return
      const all = rowsRef.current
      const key = e.key.toLowerCase()
      if (key === 'j' || key === 'k') {
        e.preventDefault()
        const next = Math.max(
          0,
          Math.min(all.length - 1, cursorRef.current + (key === 'j' ? 1 : -1)),
        )
        setCursor(next)
        const id = all[next]?.id
        if (id)
          document
            .querySelector(`[data-doc-id="${id}"]`)
            ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      } else if (key === 'enter' && cursorRef.current >= 0) {
        const d = all[cursorRef.current]
        if (
          d &&
          !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)
        ) {
          e.preventDefault()
          navigate({ to: docPath(d), params: { id: d.id } })
        }
      } else if (key === 'x' && cursorRef.current >= 0) {
        const d = all[cursorRef.current]
        if (d) toggle(d.id)
      } else if (e.key === 'Escape') {
        setSelected(new Set())
        setCursor(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, toggle])

  const selectedDocs = rows.filter((d) => selected.has(d.id))
  const selectedSum = selectedDocs
    .filter((d) => d.status === 'issued' || d.status === 'paid')
    .reduce((sum, d) => sum.plus(czkTotal(d)), new Decimal(0))
    .toFixed(2)
  const allSelected = rows.length > 0 && selected.size === rows.length

  return {
    selected,
    selectedDocs,
    selectedSum,
    allSelected,
    activeId: rows[cursor]?.id,
    toggle,
    toggleAll: () => setSelected(allSelected ? new Set() : new Set(rows.map((d) => d.id))),
    clear,
  }
}
