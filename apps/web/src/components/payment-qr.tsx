import { cn } from '@fakturky/ui/lib/utils'
import { cs } from '@/i18n/cs'

export type PaymentQrData = { kind: 'spayd' | 'epc'; viewBox: number; path: string }

/** Quiet zone in modules (the QR standard asks for 4); drawn inside the SVG so it stays white in dark mode. */
const QUIET = 4

/**
 * Payment QR (QR Platba / EPC) as SVG. Always black on white with its own quiet zone, in light and dark theme,
 * so banking apps can read it. At least 160 px wide.
 */
export function PaymentQr({ qr, className }: { qr: PaymentQrData; className?: string }) {
  const label = qr.kind === 'spayd' ? cs.paymentQr.platba : cs.paymentQr.epc
  const size = qr.viewBox + QUIET * 2
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${-QUIET} ${-QUIET} ${size} ${size}`}
      className={cn('size-40 shrink-0 rounded-md bg-white sm:size-44', className)}
      shapeRendering="crispEdges"
      data-testid="payment-qr"
    >
      <rect x={-QUIET} y={-QUIET} width={size} height={size} fill="#fff" />
      <path d={qr.path} stroke="#000" fill="none" />
    </svg>
  )
}
