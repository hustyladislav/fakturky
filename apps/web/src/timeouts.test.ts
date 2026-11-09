import { expect, test } from 'vitest'
import { pgliteTimeouts } from '../../../vitest.shared'

// Vitest projects do not inherit timeouts from the root config; without this a busy machine fails database tests at 5 s.
test('this project runs with the long database timeout', ({ task }) => {
  expect(task.timeout).toBe(pgliteTimeouts.testTimeout)
})
