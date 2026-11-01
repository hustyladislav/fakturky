/** Single source of truth for the product name and links. Never hardcode these elsewhere. */
export const BRAND = {
  name: 'Fakturky',
  slug: 'fakturky',
  tagline: 'Svobodné fakturační řešení pro české živnostníky a firmy',
  supportUrl: 'https://buymeacoffee.com/ladislavhusty',
  repoUrl: 'https://github.com/hustyladislav/fakturky',
  docsUrl: 'https://github.com/hustyladislav/fakturky/tree/main/docs',
  issuesUrl: 'https://github.com/hustyladislav/fakturky/issues',
  apiKeyPrefix: 'fk_',
} as const

export type Brand = typeof BRAND
