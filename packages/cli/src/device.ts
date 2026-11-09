import { BRAND } from '@fakturky/core/brand'
import { ApiError } from './api'

type Started = {
  device_code: string
  user_code: string
  verification_uri_complete: string
  interval: number
}

const post = (url: string, body: unknown) =>
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': `${BRAND.slug}-cli` },
    body: JSON.stringify(body),
  })

const SLOW_DOWN_SECONDS = 5

/** Browser approval: prints a link, waits for the user, returns the API key the server issued. */
export async function deviceLogin(
  url: string,
  show: (link: string, code: string) => void,
  sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<string> {
  const started = await post(`${url}/api/auth/device/code`, { client_id: BRAND.slug })
  if (!started.ok) throw new ApiError(started.status, 'Přihlášení se nepodařilo zahájit.')
  const flow = (await started.json()) as Started
  show(flow.verification_uri_complete, flow.user_code)

  let wait = flow.interval
  for (;;) {
    await sleep(wait * 1000)
    const res = await post(`${url}/api/device/token`, {
      device_code: flow.device_code,
      client_id: BRAND.slug,
    })
    const data = (await res.json()) as { api_key?: string; error?: string }
    if (data.api_key) return data.api_key
    if (data.error === 'slow_down') wait += SLOW_DOWN_SECONDS
    else if (data.error === 'access_denied') throw new ApiError(403, 'Přístup byl zamítnut.')
    else if (data.error !== 'authorization_pending') {
      throw new ApiError(res.status, 'Platnost přihlášení vypršela. Spusťte ho znovu.')
    }
  }
}
