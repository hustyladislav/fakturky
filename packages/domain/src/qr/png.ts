import QRCode from 'qrcode'

export interface QrPngOptions {
  /** Pixels per module (default 8). */
  scale?: number
  /** Quiet-zone modules (default 4, the QR standard). */
  margin?: number
}

/** Black-on-white PNG bytes, error correction level M. Node only (used for the e-mail image). */
export function renderQrPng(text: string, opts: QrPngOptions = {}): Promise<Uint8Array> {
  return QRCode.toBuffer(text, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: opts.margin ?? 4,
    scale: opts.scale ?? 8,
    color: { dark: '#000000', light: '#ffffff' },
  })
}
