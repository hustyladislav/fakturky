import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

it('loads the package root under native Node ESM (no bundler)', () => {
  const root = fileURLToPath(new URL('../src/index.ts', import.meta.url))
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', `import(${JSON.stringify(root)}).then(m => console.log(m.formatCzk('1')))`], { encoding: 'utf8' })
  expect(out.trim()).toBe('1,00 Kč')
})
