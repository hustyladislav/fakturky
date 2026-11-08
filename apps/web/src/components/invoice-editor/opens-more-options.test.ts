import { describe, expect, it } from 'vitest'
import { opensMoreOptions } from './opens-more-options'

const base = { introText: '', footerText: '', privateNote: '', orderNumber: '', language: 'cs' }

describe('opensMoreOptions', () => {
  it('stays closed on a new invoice even when the profile seeded a footer or language', () => {
    expect(opensMoreOptions(false, { ...base, footerText: 'Děkujeme', language: 'en' })).toBe(false)
  })

  it('opens for a stored draft that uses any of the optional fields', () => {
    expect(opensMoreOptions(true, { ...base, footerText: 'Děkujeme' })).toBe(true)
    expect(opensMoreOptions(true, { ...base, orderNumber: 'OBJ-1' })).toBe(true)
    expect(opensMoreOptions(true, { ...base, language: 'sk' })).toBe(true)
  })

  it('stays closed for a stored draft that uses none of them', () => {
    expect(opensMoreOptions(true, base)).toBe(false)
  })
})
