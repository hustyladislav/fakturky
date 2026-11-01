import { beforeEach, expect, test, vi } from 'vitest'

const send = vi.fn()
vi.mock('resend', () => ({
  Resend: class {
    emails = { send }
  },
}))

const { EmailDeliveryError, sendMagicLinkEmail } = await import('./index')
const config = { apiKey: 're_test', from: 'Fakturky <a@example.com>' }

beforeEach(() => send.mockReset())

test('sends html + text through Resend', async () => {
  send.mockResolvedValue({ data: { id: '1' }, error: null })
  await sendMagicLinkEmail(config, { to: 'me@example.com', url: 'https://x.test/l' })
  const arg = send.mock.calls[0]?.[0]
  expect(arg).toMatchObject({ from: config.from, to: 'me@example.com' })
  expect(arg.html).toContain('https://x.test/l')
  expect(arg.text).toContain('https://x.test/l')
})

test('sandbox recipient rejection surfaces as EmailDeliveryError(403)', async () => {
  send.mockResolvedValue({
    data: null,
    error: {
      statusCode: 403,
      name: 'validation_error',
      message: 'You can only send testing emails to your own email address',
    },
  })
  await expect(
    sendMagicLinkEmail(config, { to: 'other@example.com', url: 'https://x.test/l' }),
  ).rejects.toMatchObject({ name: 'EmailDeliveryError', status: 403 })
  expect(EmailDeliveryError).toBeDefined()
})
