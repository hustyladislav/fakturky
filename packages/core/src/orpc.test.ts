import { createRouterClient, ORPCError } from '@orpc/server'
import { describe, expect, test } from 'vitest'
import type { BaseContext } from './context'
import { MailError } from './context'
import { DomainError } from './errors'
import { publicProcedure } from './orpc'

const failing = (error: Error) =>
  createRouterClient(
    {
      run: publicProcedure.handler(() => {
        throw error
      }),
    },
    { context: { db: null as never, principal: null } satisfies BaseContext },
  ).run()

describe('a handler that throws without wrapping anything', () => {
  test('a domain refusal keeps its code, message and fields', async () => {
    const e = await failing(new DomainError('CONFLICT', 'Already issued', ['number'])).catch(
      (x) => x,
    )
    expect(e).toBeInstanceOf(ORPCError)
    expect(e).toMatchObject({
      code: 'CONFLICT',
      message: 'Already issued',
      data: { fields: ['number'] },
    })
  })

  test('undeliverable mail is a service failure with its reason', async () => {
    const e = await failing(new MailError('EMAIL_NOT_CONFIGURED')).catch((x) => x)
    expect(e).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      data: { reason: 'EMAIL_NOT_CONFIGURED' },
    })
  })

  test('an unexpected error is not disguised as a domain one', async () => {
    const e = await failing(new Error('boom')).catch((x) => x)
    expect(e).not.toMatchObject({ code: 'CONFLICT' })
    expect(e.message).toBe('boom')
  })
})
