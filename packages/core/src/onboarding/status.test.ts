import { afterAll, describe, expect, test } from 'vitest'
import { listToolDescriptors } from '../agent-tools'
import { clientFor, createTestDb, seedOrg } from '../testing'
import { renderRunbook } from './runbook'
import { type OnboardingFacts, onboardingSteps, summarize } from './status'

const blank: OnboardingFacts = {
  profileFilled: false,
  bankAccounts: 0,
  fioAccountWithoutToken: false,
  documents: 0,
  nonDraftDocuments: 0,
  numberingAdvanced: false,
}
const tools = new Set(listToolDescriptors().map((t) => t.name))
const byId = (facts: Partial<OnboardingFacts>) =>
  Object.fromEntries(onboardingSteps({ ...blank, ...facts }).map((s) => [s.id, s]))

describe('checklist', () => {
  test('a new organization starts at the business profile and is not complete', () => {
    expect(summarize(onboardingSteps(blank))).toMatchObject({
      complete: false,
      next: 'business_profile',
    })
  })

  test('only the business profile is required; the rest stays offered', () => {
    const status = summarize(onboardingSteps({ ...blank, profileFilled: true }))
    expect(status).toMatchObject({ complete: true, next: 'bank_account' })
  })

  test('nothing is left once every step is done', () => {
    const facts = { profileFilled: true, bankAccounts: 1, documents: 1, nonDraftDocuments: 1 }
    expect(summarize(onboardingSteps({ ...blank, ...facts }))).toMatchObject({
      complete: true,
      next: null,
    })
  })

  test('numbering history is settled by issued documents or a raised counter, not by a draft', () => {
    expect(byId({ documents: 1 }).history?.status).toBe('todo')
    expect(byId({ documents: 1, nonDraftDocuments: 1 }).history?.status).toBe('done')
    expect(byId({ numberingAdvanced: true }).history?.status).toBe('done')
  })

  test('the Fio step appears only for a Fio account without a token, and is the human one', () => {
    expect(byId({}).bank_sync).toBeUndefined()
    expect(byId({ fioAccountWithoutToken: true }).bank_sync).toMatchObject({
      kind: 'human',
      path: '/banka',
    })
  })

  test('no step ever hands an agent a tool that issues or sends', () => {
    for (const step of onboardingSteps({ ...blank, fioAccountWithoutToken: true })) {
      expect(step.tools.join()).not.toMatch(/issue|send/)
    }
  })

  test('every tool a step names exists', () => {
    for (const step of onboardingSteps({ ...blank, fioAccountWithoutToken: true })) {
      for (const tool of step.tools) expect(tools, `${step.id}: ${tool}`).toContain(tool)
    }
  })

  test('every tool the runbook names exists', () => {
    const named = renderRunbook('https://x.test').match(/`[a-z]+(?:_[a-z]+)+`/g) ?? []
    expect(named.length).toBeGreaterThan(0)
    for (const name of named) expect(tools).toContain(name.slice(1, -1))
  })
})

describe('against the database', () => {
  const handlePromise = createTestDb()
  afterAll(async () => (await handlePromise).close())

  test('a partial profile update does not count as a finished setup', async () => {
    const handle = await handlePromise
    const organizationId = await seedOrg(handle, 'partial')
    const api = clientFor(handle, { userId: 'u', organizationId, via: 'apiKey' })
    expect((await api.onboarding.status({})).next).toBe('business_profile')

    await api.businessProfile.update({ email: 'a@example.com' })
    expect((await api.onboarding.status({})).next).toBe('business_profile')

    await api.businessProfile.update({
      address: { street: 'Dlouhá 1', city: '', zip: '', country: 'CZ' },
    })
    expect((await api.onboarding.status({})).next).toBe('business_profile')

    await api.businessProfile.update({
      legalName: 'Firma s.r.o.',
      address: { street: 'Dlouhá 1', city: 'Praha', zip: '11000', country: 'CZ' },
    })
    const after = await api.onboarding.status({})
    expect(after).toMatchObject({ complete: true, next: 'bank_account' })
  })
})
