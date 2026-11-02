import { useLayoutEffect, useState } from 'react'

/**
 * Counts from 0 to `target` once, on first paint (ease-out). Returns `target` immediately on the
 * server, with `prefers-reduced-motion`, or when `enabled` is false, so SSR output never mismatches.
 */
export function useCountUp(target: number, { duration = 700, enabled = true } = {}): number {
  const [value, setValue] = useState(target)
  useLayoutEffect(() => {
    if (!enabled || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    let raf = 0
    const start = performance.now()
    setValue(0)
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setValue(target * (1 - (1 - t) ** 3))
      if (t < 1) raf = requestAnimationFrame(tick)
      else setValue(target)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, enabled])
  return value
}
