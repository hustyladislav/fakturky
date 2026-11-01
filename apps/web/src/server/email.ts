import { EmailDeliveryError, sendMagicLinkEmail } from '@fakturky/email'
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
