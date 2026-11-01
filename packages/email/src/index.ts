import { BRAND } from '@fakturky/core/brand'
import { render } from '@react-email/render'
import { Resend } from 'resend'
import { MagicLinkEmail } from './magic-link'

export { MagicLinkEmail }

/** Resend rejected the message; `status` is Resend's HTTP status (403 = sandbox recipient limit). */
export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message)
    this.name = 'EmailDeliveryError'
  }
}

export type EmailConfig = { apiKey: string; from: string }

/** Sends the Czech magic-link email through Resend. Throws if Resend rejects the message. */
export async function sendMagicLinkEmail(
  config: EmailConfig,
  message: { to: string; url: string },
): Promise<void> {
  const resend = new Resend(config.apiKey)
  const react = MagicLinkEmail({ url: message.url })
  const { error } = await resend.emails.send({
    from: config.from,
    to: message.to,
    subject: `Přihlášení do aplikace ${BRAND.name}`,
    html: await render(react),
    text: await render(react, { plainText: true }),
  })
  if (error) throw new EmailDeliveryError(`Resend: ${error.message}`, error.statusCode)
}
