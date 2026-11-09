import { defineProject } from 'vitest/config'
import { pgliteTimeouts } from '../../vitest.shared'

export default defineProject({ test: pgliteTimeouts })
