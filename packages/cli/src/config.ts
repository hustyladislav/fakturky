import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { BRAND } from '@fakturky/core/brand'

export const DEFAULT_URL = 'https://fakturky.vercel.app'

export type Config = { apiKey?: string; url?: string }

export function configDir(env = process.env, platform = process.platform): string {
  if (env.XDG_CONFIG_HOME) return join(env.XDG_CONFIG_HOME, BRAND.slug)
  if (platform === 'win32' && env.APPDATA) return join(env.APPDATA, BRAND.slug)
  return join(homedir(), '.config', BRAND.slug)
}

export const configFile = () => join(configDir(), 'config.json')
export const specCacheFile = () => join(configDir(), 'openapi-cache.json')

export async function readConfig(): Promise<Config> {
  try {
    return JSON.parse(await readFile(configFile(), 'utf8')) as Config
  } catch {
    return {}
  }
}

/** Stores credentials readable by the current user only (dir 0700, file 0600). */
export async function writeConfig(config: Config): Promise<void> {
  const file = configFile()
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  await writeFile(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
  await chmod(file, 0o600)
}

export async function clearConfig(): Promise<void> {
  await rm(configFile(), { force: true })
}

/** Environment variables override the stored config. */
export async function resolveCredentials(env = process.env) {
  const stored = await readConfig()
  return {
    apiKey: env.FAKTURKY_API_KEY ?? stored.apiKey,
    url: (env.FAKTURKY_URL ?? stored.url ?? DEFAULT_URL).replace(/\/+$/, ''),
  }
}
