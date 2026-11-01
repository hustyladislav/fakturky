import QRCode from 'qrcode'

export interface QrSvgOptions {
  /** Quiet-zone modules (default 2). */
  margin?: number
  /** Pixel width of the SVG, omit for scalable. */
  width?: number
  dark?: string
  light?: string
}

/** Renders text to an SVG string, error correction level M. */
export async function renderQrSvg(text: string, opts: QrSvgOptions = {}): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: opts.margin ?? 2,
    ...(opts.width ? { width: opts.width } : {}),
    color: { dark: opts.dark ?? '#000000', light: opts.light ?? '#ffffff' },
  })
}
