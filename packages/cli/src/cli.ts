import * as p from '@clack/prompts'
import { BRAND } from '@fakturky/core/brand'
import { defineCommand, runMain } from 'citty'
import pkg from '../package.json' with { type: 'json' }
import { ApiError, loadOperations, request } from './api'
import { buildGroupCommands, guard, output } from './commands'
import { clearConfig, DEFAULT_URL, readConfig, resolveCredentials, writeConfig } from './config'
import { render } from './format'

const credentials = async () => {
  const creds = await resolveCredentials()
  if (!creds.apiKey) {
    throw new ApiError(401, `Not logged in. Run \`${BRAND.slug} login\` or set FAKTURKY_API_KEY.`)
  }
  return creds
}

const login = defineCommand({
  meta: { name: 'login', description: 'Store an API key (create one in Nastavení → API klíče)' },
  args: {
    key: { type: 'string', description: 'API key (fk_…); prompted when omitted' },
    url: { type: 'string', description: `Server URL (default ${DEFAULT_URL})` },
  },
  run: ({ args }) =>
    guard(async () => {
      const stored = await readConfig()
      const url = (args.url ?? process.env.FAKTURKY_URL ?? stored.url ?? DEFAULT_URL).replace(
        /\/+$/,
        '',
      )
      let apiKey = args.key
      if (!apiKey) {
        p.intro(BRAND.name)
        const answer = await p.password({
          message: 'Vložte API klíč (fk_…)',
          validate: (v) => (v?.startsWith('fk_') ? undefined : 'Klíč musí začínat fk_'),
        })
        if (p.isCancel(answer)) return p.cancel('Přerušeno.')
        apiKey = answer
      }
      const me = (await request({ apiKey, url }, 'GET', '/whoami')) as { organizationName: string }
      await writeConfig({ apiKey, url })
      console.log(`Přihlášeno k organizaci ${me.organizationName} (${url}).`)
    }),
})

const logout = defineCommand({
  meta: { name: 'logout', description: 'Remove the stored API key' },
  async run() {
    await clearConfig()
    console.log('Odhlášeno.')
  },
})

const whoami = defineCommand({
  meta: { name: 'whoami', description: 'Show the organization the stored API key acts on' },
  args: { json: { type: 'boolean', description: 'Print raw JSON' } },
  run: ({ args }) =>
    guard(async () => {
      const me = await request(await credentials(), 'GET', '/whoami')
      output(args.json ? me : render(me), args.json === true)
    }),
})

async function main() {
  const creds = await resolveCredentials()
  const operations = (await loadOperations(creds.url)) ?? []

  const root = defineCommand({
    meta: {
      name: BRAND.slug,
      version: pkg.version,
      description: `${BRAND.name} CLI — every command is generated from the server OpenAPI spec`,
    },
    subCommands: { login, logout, whoami, ...buildGroupCommands(operations, credentials) },
  })

  await runMain(root)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
