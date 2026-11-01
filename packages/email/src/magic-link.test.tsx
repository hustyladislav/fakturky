import { render } from '@react-email/render'
import { expect, test } from 'vitest'
import { MagicLinkEmail } from './magic-link'

test('magic link email is Czech and contains the link', async () => {
  const html = await render(<MagicLinkEmail url="https://example.com/x?token=abc" />)
  expect(html).toContain('Přihlásit se')
  expect(html).toContain('https://example.com/x?token=abc')
})
