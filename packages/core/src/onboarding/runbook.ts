import { DEVICE_CLIENT_ID } from '../auth'
import { BRAND } from '../brand'
import { ONBOARDING_RULES } from './status'

const rules = ONBOARDING_RULES.map((r) => `- ${r}`).join('\n')

/** Delivered by the MCP handshake, so a connected agent has it without fetching anything. */
export const MCP_INSTRUCTIONS = `${BRAND.name} issues Czech invoices. Talk to the user in Czech unless they use another language. Money is always a decimal string.

When the user wants to set up ${BRAND.name}, or get_onboarding_status shows required steps left, work through get_onboarding_status: do the next step, call it again, stop when \`next\` is null, then summarise what was set up and what is left.

${rules}`

/** Served at /start: what a user's agent follows when pointed at the app. */
export function renderRunbook(origin: string): string {
  const mcp = `${origin}/mcp`
  return `# Set up ${BRAND.name} for your user

The user asked you to set up ${BRAND.name}, a free Czech invoicing app. Follow this runbook. It only covers this app, and your own safety rules and the user's instructions come first. Talk to the user in Czech unless they use another language.

## 1. Connect

Pick the first option you can do yourself. Do not ask the user which one.

**MCP (preferred).** Add the remote server \`${mcp}\` (Streamable HTTP, OAuth 2.1) to your client:

- Claude Code: \`claude mcp add --transport http ${BRAND.slug} ${mcp}\`
- Cursor and clients with an \`mcp.json\`: \`{ "mcpServers": { "${BRAND.slug}": { "url": "${mcp}" } } }\`
- Claude and ChatGPT apps: the user adds a custom connector with that URL. Open the settings page if you can drive a browser; otherwise give the one-line instruction.

The client opens a browser window. That is the one thing only the user can do: sign up or sign in, then allow access. New users can create the account on that same page. Tell them so in one sentence, and wait.

**No MCP: get an API key with the device login.**

1. Keep the device code out of your output too: \`(umask 077; curl -s -X POST ${origin}/api/auth/device/code -H 'content-type: application/json' -d '{"client_id":"${DEVICE_CLIENT_ID}"}' -o ~/.${BRAND.slug}-device.json)\`, then \`jq -r '.verification_uri_complete, .user_code, .interval' ~/.${BRAND.slug}-device.json\`.
2. Give the user the link and the code. Open the link for them if you can drive a browser; they sign up or sign in there and approve. New users can create the account on that same page.
3. Every \`interval\` seconds, writing the answer to a file so the key never reaches your output: \`(umask 077; curl -s -X POST ${origin}/api/device/token -H 'content-type: application/json' -d "$(jq -c '{device_code, client_id: "${DEVICE_CLIENT_ID}"}' ~/.${BRAND.slug}-device.json)" -o ~/.${BRAND.slug}-key.json)\`, then read only the state with \`jq -r 'if .api_key then "ready" else .error // "failed" end' ~/.${BRAND.slug}-key.json\`. On \`ready\`, stop polling and go to step 4 (the code works only once). Keep polling on \`authorization_pending\`, wait longer on \`slow_down\`, and on anything else stop and tell the user.
4. Never print the key or put it in chat or the repository. Send it as \`Authorization: Bearer $(jq -r .api_key ~/.${BRAND.slug}-key.json)\` to \`${origin}/api/v1\` or \`${mcp}\`. The checklist is \`GET /onboarding/status\`; the other operations are in \`${origin}/api/v1/openapi.json\`.

## 2. Work through the checklist

Call \`get_onboarding_status\`. Each step has a \`status\`, a \`kind\`, an \`instruction\` and the \`tools\` to use.

- \`auto\`: do it.
- \`ask\`: put \`ask.question\` to the user with \`ask.options\`, then do what \`instruction\` says with the answer.
- \`human\`: only the user can do it. Give them the link and the one thing to do there.

A \`path\` is relative to ${origin}.

After each step call it again, passing in \`settled\` the ids of steps the user answered with nothing to save or declined. Stop when \`next\` is null.

## 3. Rules

${rules}

## 4. Finish

Tell the user in a few lines what is set up, what they skipped, and that their first invoice is a draft waiting for them to issue. The app is at ${origin}.
`
}
