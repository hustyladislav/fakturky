import { sendMagicLinkEmail } from '@fakturky/email'
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
  await sendMagicLinkEmail(
    { apiKey, from: process.env.EMAIL_FROM ?? 'Fakturky <onboarding@resend.dev>' },
    { to: email, url },
  )
}
