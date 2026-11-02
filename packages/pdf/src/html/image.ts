import type { SheetImage } from '../model.ts'

/** URL / data URL for a logo or signature given as a URL or as PNG/JPEG bytes; null when there is none. */
export function imageSrc(image: SheetImage): string | null {
  if (!image) return null
  if (typeof image === 'string') return image
  if (image.length === 0) return null
  const isPng = image[0] === 0x89 && image[1] === 0x50
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < image.length; i += chunk) {
    binary += String.fromCharCode(...image.subarray(i, i + chunk))
  }
  return `data:image/${isPng ? 'png' : 'jpeg'};base64,${btoa(binary)}`
}
