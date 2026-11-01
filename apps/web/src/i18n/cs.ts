import { BRAND } from '@fakturky/core/brand'

/** All user-facing copy lives here. Natural Czech, correct diacritics. */
export const cs = {
  brand: BRAND.name,
  nav: {
    overview: 'Přehled',
    invoices: 'Faktury',
    contacts: 'Kontakty',
    settings: 'Nastavení',
  },
  common: {
    save: 'Uložit',
    cancel: 'Zrušit',
    create: 'Vytvořit',
    archive: 'Archivovat',
    search: 'Hledat…',
    loading: 'Načítám…',
    notFound: 'Stránka nebyla nalezena.',
    error: 'Něco se pokazilo. Zkuste to prosím znovu.',
    signOut: 'Odhlásit se',
    support: 'Podpořit projekt',
  },
  theme: {
    system: 'Podle systému',
    light: 'Světlý motiv',
    dark: 'Tmavý motiv',
  },
  status: {
    draft: 'Koncept',
    issued: 'Vystavená',
    overdue: 'Po splatnosti',
    partial: 'Částečně uhrazená',
    paid: 'Zaplacená',
    cancelled: 'Stornovaná',
  },
  auth: {
    signInTitle: 'Přihlášení',
    signInDescription: 'Vítejte zpět. Přihlaste se ke svému účtu.',
    signUpTitle: 'Vytvořit účet',
    signUpDescription: 'Fakturujte zdarma. Bez omezení počtu faktur a kontaktů.',
    name: 'Jméno a příjmení',
    email: 'E-mail',
    password: 'Heslo',
    passwordHint: 'Alespoň 8 znaků',
    signInAction: 'Přihlásit se',
    signUpAction: 'Vytvořit účet',
    passkeyAction: 'Přihlásit se přístupovým klíčem',
    noAccount: 'Ještě nemáte účet?',
    haveAccount: 'Už máte účet?',
    invalidCredentials: 'Nesprávný e-mail nebo heslo.',
    signUpFailed: 'Účet se nepodařilo vytvořit. Zkontrolujte údaje a zkuste to znovu.',
  },
  overview: {
    title: 'Přehled',
    welcome: 'Vítejte',
    empty: 'Zatím tu nic není. Začněte přidáním prvního kontaktu.',
  },
  invoices: {
    title: 'Faktury',
    empty: 'Faktury přibudou brzy.',
    soon: 'Tvorba faktur je v přípravě.',
  },
  contacts: {
    title: 'Kontakty',
    new: 'Nový kontakt',
    empty: 'Zatím nemáte žádné kontakty.',
    name: 'Název nebo jméno',
    ico: 'IČO',
    dic: 'DIČ',
    email: 'E-mail',
    phone: 'Telefon',
    created: 'Kontakt byl vytvořen.',
    archived: 'Kontakt byl archivován.',
  },
  settings: {
    title: 'Nastavení',
    soon: 'Nastavení firmy a bankovních účtů je v přípravě.',
  },
} as const

export type Dictionary = typeof cs
