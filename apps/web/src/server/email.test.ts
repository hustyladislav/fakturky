import { afterEach, expect, test, vi } from 'vitest'

class EmailDeliveryError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message)
  }
}
const sendMagicLinkEmail = vi.fn()
vi.mock('@fakturky/email', () => ({ EmailDeliveryError, sendMagicLinkEmail }))

const { deliverMagicLink } = await import('./email')

afterEach(() => {
  vi.unstubAllEnvs()
  sendMagicLinkEmail.mockReset()
})

test('Resend 403 becomes a typed 503 EMAIL_RESTRICTED without logging the address', async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test')
  sendMagicLinkEmail.mockRejectedValue(new EmailDeliveryError('nope', 403))
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  await expect(deliverMagicLink({ email: 'x@example.com', url: 'u' })).rejects.toMatchObject({
    status: 'SERVICE_UNAVAILABLE',
    body: { message: 'EMAIL_RESTRICTED' },
  })
  expect(warn.mock.calls.flat().join(' ')).not.toContain('x@example.com')
})

test('other failures are not swallowed', async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test')
  sendMagicLinkEmail.mockRejectedValue(new Error('boom'))
  await expect(deliverMagicLink({ email: 'x@example.com', url: 'u' })).rejects.toThrow('boom')
})
