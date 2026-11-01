// Local dev seed: signs up demo users against a RUNNING local dev server (PGlite) and fills realistic data.
// Usage: pnpm dev (terminal 1) → pnpm db:seed (terminal 2). Refuses non-local targets.
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'

const base = process.env.SEED_URL ?? 'http://localhost:3000'
if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(base)) {
  throw new Error(`Refusing to seed non-local target: ${base}`)
}

const PASSWORD = 'demo-heslo-123' // local test credential, documented in .env.example
const day = 86_400_000
const iso = (offset) => new Date(Date.now() + offset * day).toISOString().slice(0, 10)

async function signUp(email, name) {
  const res = await fetch(`${base}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ email, name, password: PASSWORD }),
  })
  if (!res.ok) {
    const signIn = await fetch(`${base}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
    if (!signIn.ok) throw new Error(`auth failed for ${email}: ${await res.text()}`)
    return cookieOf(signIn)
  }
  return cookieOf(res)
}

const cookieOf = (res) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')

const contacts = [
  ['Novák & syn s.r.o.', '27082440', 'CZ27082440', 'Praha', 'Vinohradská 12', '120 00'],
  ['Kavárna U Mostu', '12345679', null, 'Brno', 'Mostecká 3', '602 00'],
  ['Studio Lípa s.r.o.', '25596641', 'CZ25596641', 'Ostrava', 'Lipová 8', '702 00'],
  ['Ing. Petr Dvořák', '45274649', null, 'Plzeň', 'Americká 21', '301 00'],
  ['Technologie Morava a.s.', '60193336', 'CZ60193336', 'Olomouc', 'Průmyslová 100', '779 00'],
  ['Marie Svobodová', null, null, 'České Budějovice', 'Dlouhá 5', '370 01'],
  ['Alpine Software GmbH', null, 'DE123456789', 'Wien', 'Mariahilfer Str. 10', '1060'],
  ['Mateřská škola Sluníčko', '70890013', null, 'Hradec Králové', 'Školní 2', '500 02'],
]

const items = [
  ['Webový vývoj', 'hod', '1500'],
  ['Konzultace', 'hod', '1200'],
  ['Měsíční správa webu', 'ks', '3500'],
  ['Grafický návrh loga', 'ks', '9000'],
  ['Licence softwaru', 'ks', '4800'],
  ['Cestovné', 'km', '9.5'],
]

async function seedUser({ email, name, payer, invoices, euro }) {
  const cookie = await signUp(email, name)
  const api = createORPCClient(
    new RPCLink({ url: `${base}/api/rpc`, headers: { cookie, origin: base } }),
  )

  if ((await api.contacts.list({})).length > 0) return console.log(`${email}: already seeded`)

  await api.businessProfile.update({
    legalName: payer ? 'Webová dílna Dvořák s.r.o.' : name,
    ico: payer ? '27082440' : '87654321',
    dic: payer ? 'CZ27082440' : null,
    vatStatus: payer ? 'payer' : 'non_payer',
    address: { street: 'Dlouhá 15', city: 'Praha', zip: '110 00' },
    email: email,
    phone: '+420 777 123 456',
  })
  await api.bankAccounts.create({ label: 'Hlavní účet', account: '19-2000145399/0800' })
  if (euro) {
    await api.bankAccounts.create({
      label: 'EUR účet',
      currency: 'EUR',
      account: 'CZ6508000000192000145399',
    })
  }

  const created = []
  for (const [n, ico, dic, city, street, zip] of contacts) {
    created.push(
      await api.contacts.create({
        name: n,
        ico,
        dic,
        address: { street, city, zip },
        emails: [
          `fakturace@${n
            .toLowerCase()
            .replace(/[^a-z]/g, '')
            .slice(0, 10)}.cz`,
        ],
      }),
    )
  }

  for (let i = 0; i < invoices; i++) {
    const contact = created[i % created.length]
    const foreign = euro && contact.name.startsWith('Alpine')
    const age = 100 - Math.round((i / invoices) * 95) // oldest first
    const issueDate = iso(-age)
    const lines = [0, 1, 2].slice(0, 1 + (i % 3)).map((k) => {
      const [description, unit, price] = items[(i + k) % items.length]
      return {
        description,
        unit,
        quantity: String(1 + ((i + k) % 5)),
        unitPrice: foreign ? String(Math.round(Number(price) / 25)) : price,
        vatRate: payer ? '21' : '0',
      }
    })
    const draft = await api.documents.createDraft({
      contactId: contact.id,
      issueDate,
      dueDate: iso(-age + 14),
      currency: foreign ? 'EUR' : 'CZK',
      ...(foreign ? { exchangeRate: '25.00' } : {}),
      lines,
    })
    if (i >= invoices - 3) continue // leave the newest as drafts
    const issued = await api.documents.issue({ id: draft.id })
    if (i % 5 === 4) await api.documents.cancel({ id: issued.id })
    else if (i % 3 !== 0) await api.documents.markPaid({ id: issued.id })
    else if (i % 6 === 3) {
      await api.documents.markPaid({
        id: issued.id,
        amount: String(Math.round(Number(issued.total) / 3)),
      })
    }
  }
  console.log(`seeded ${email} (${payer ? 'plátce DPH' : 'neplátce'}), ${invoices} invoices`)
}

await seedUser({
  email: 'demo@example.cz',
  name: 'Jana Nováková',
  payer: true,
  invoices: 30,
  euro: true,
})
await seedUser({
  email: 'neplatce@example.cz',
  name: 'Petr Svoboda',
  payer: false,
  invoices: 8,
  euro: false,
})
console.log(`Hotovo. Přihlášení: demo@example.cz / ${PASSWORD}`)
