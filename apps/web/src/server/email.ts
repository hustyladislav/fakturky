import { MailError, type SendInvoiceArgs } from '@fakturky/core/context'
import { EmailDeliveryError, sendInvoiceEmail, sendMagicLinkEmail } from '@fakturky/email'
import { APIError } from 'better-auth/api'

/**
 * Magic-link delivery. Without RESEND_API_KEY: log the link outside production (local dev),
 * and tell the client that email is unavailable in production.
 */
export async function deliverMagicLink({ email, url }: { email: string; url: string }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[magic-link] ${email}: ${url}`)
      return
    }
    throw new APIError('SERVICE_UNAVAILABLE', { message: 'EMAIL_NOT_CONFIGURED' })
  }
  try {
    await sendMagicLinkEmail(
      { apiKey, from: process.env.EMAIL_FROM ?? 'Fakturky <onboarding@resend.dev>' },
      { to: email, url },
    )
  } catch (error) {
    // Resend's sandbox only delivers to the account owner (403/422 for anyone else).
    if (error instanceof EmailDeliveryError && (error.status === 403 || error.status === 422)) {
      console.warn(
        `[magic-link] Resend refused delivery (status ${error.status}); sandbox recipient limit`,
      )
      throw new APIError('SERVICE_UNAVAILABLE', { message: 'EMAIL_RESTRICTED' })
    }
    throw error
  }
}

/** Public origin for links in e-mails: BETTER_AUTH_URL, else the request's own origin. */
export function publicBaseUrl(headers: Headers): string {
  const configured =
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined)
  if (configured) return configured.replace(/\/$/, '')
  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? 'localhost:3000'
  const proto =
    headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

/** Invoice / reminder delivery through Resend; failures are mapped to `MailError` reasons. */
export async function deliverInvoice(args: SendInvoiceArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[invoice-email] to ${args.to}: ${args.number} ${args.publicUrl}`)
      return
    }
    throw new MailError('EMAIL_NOT_CONFIGURED')
  }
  try {
    await sendInvoiceEmail(
      { apiKey, from: process.env.EMAIL_FROM ?? 'Fakturky <onboarding@resend.dev>' },
      args,
    )
  } catch (error) {
    // Resend only delivers to verified domains / the account owner until a domain is verified.
    if (error instanceof EmailDeliveryError && (error.status === 403 || error.status === 422)) {
      throw new MailError('EMAIL_RESTRICTED')
    }
    throw new MailError('EMAIL_FAILED')
  }
}
