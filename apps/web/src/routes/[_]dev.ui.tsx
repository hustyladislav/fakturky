import { createFileRoute, notFound } from '@tanstack/react-router'
import { lazy } from 'react'

// Dev-only gallery of the design-v2 primitives. `import.meta.env.DEV` is a build-time constant,
// so production bundles drop the dynamic import (and the gallery) entirely and the route 404s.
const Gallery = import.meta.env.DEV
  ? lazy(() => import('@/components/dev/ui-gallery').then((m) => ({ default: m.UiGallery })))
  : () => null

export const Route = createFileRoute('/_dev/ui')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: Gallery,
})
