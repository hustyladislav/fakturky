import { BRAND } from '@fakturky/core/brand'

/** Long-form legal copy. Inline links use [text](url); **bold** is supported. Drafts pending legal review. */
export interface LegalSection {
  heading: string
  body: ReadonlyArray<string | { list: readonly string[] }>
}

const contact = '[KONTAKTNÍ E-MAIL PROVOZOVATELE]'

export const termsSections: readonly LegalSection[] = [
  {
    heading: '1. Úvod',
    body: [
      `Tyto podmínky upravují používání služby ${BRAND.name} (dále jen „služba“), kterou zdarma a ve svém volném čase provozuje fyzická osoba (dále jen „provozovatel“). Používáním služby s podmínkami souhlasíte.`,
    ],
  },
  {
    heading: '2. Co služba nabízí',
    body: [
      `Služba umožňuje vystavovat faktury a další doklady, spravovat kontakty a bankovní účty, generovat PDF a QR platby a přistupovat k datům přes webové rozhraní, API, MCP a příkazovou řádku. Zdrojový kód je veřejně dostupný na [GitHubu](${BRAND.repoUrl}).`,
    ],
  },
  {
    heading: '3. Cena a podpora',
    body: [
      'Služba je zdarma, bez omezení počtu faktur a kontaktů. Provoz lze dobrovolně podpořit darem; dar není protiplněním a nezakládá žádný nárok na funkce ani podporu.',
    ],
  },
  {
    heading: '4. Váš účet a vaše data',
    body: [
      {
        list: [
          'Za správnost zadaných údajů a obsah vystavených dokladů odpovídáte vy.',
          'Zabezpečte své přihlašovací údaje a API klíče; za jejich zneužití neneseme odpovědnost.',
          `Export svých dat nebo smazání účtu můžete požadovat na kontaktu ${contact}; samoobslužné nástroje připravujeme. Faktury vystavené v minulosti mohou podléhat vaší zákonné povinnosti uchování, kterou plníte vy.`,
        ],
      },
    ],
  },
  {
    heading: '5. Zakázané použití',
    body: [
      'Službu nesmíte používat k protiprávní činnosti, k narušování jejího provozu ani k automatizovanému hromadnému zneužívání (např. rozesílání nevyžádaných zpráv).',
    ],
  },
  {
    heading: '6. Žádná záruka',
    body: [
      'Službu poskytujeme „tak, jak je“. Snažíme se o správné výpočty (včetně DPH) a soulad s českými předpisy, nejde však o daňové ani právní poradenství. Před odevzdáním daňových přiznání či důležitých dokladů si údaje ověřte nebo je konzultujte s účetním.',
    ],
  },
  {
    heading: '7. Odpovědnost',
    body: [
      'Provozovatel neodpovídá za škody vzniklé používáním služby, výpadkem či ztrátou dat, s výjimkou případů, kdy odpovědnost nelze zákonem vyloučit.',
    ],
  },
  {
    heading: '8. Změny a ukončení',
    body: [
      'Služba i tyto podmínky se mohou měnit. O podstatných změnách vás budeme informovat v aplikaci nebo e-mailem. Provozovatel může službu kdykoli ukončit; v takovém případě vám umožní data získat.',
    ],
  },
  {
    heading: '9. Kontakt a rozhodné právo',
    body: [
      `Dotazy a hlášení problémů posílejte přes [GitHub Issues](${BRAND.issuesUrl}) nebo na ${contact}. Vztahy se řídí právem České republiky.`,
    ],
  },
]

export const privacySections: readonly LegalSection[] = [
  {
    heading: '1. Správce osobních údajů',
    body: [
      `Správcem je provozovatel služby ${BRAND.name}, fyzická osoba: [JMÉNO A PŘÍJMENÍ, ADRESA, KONTAKTNÍ E-MAIL]. Správce není povinen jmenovat pověřence pro ochranu osobních údajů.`,
    ],
  },
  {
    heading: '2. Jaké údaje zpracováváme',
    body: [
      {
        list: [
          '**Údaje o účtu:** jméno, e-mail, přihlašovací údaje (heslo ukládáme pouze jako hash; případně klíče přístupu / přihlášení přes poskytovatele).',
          '**Obsah, který vložíte:** údaje o vaší firmě, kontakty vašich odběratelů, faktury, bankovní účty. K údajům o vašich odběratelích jste správcem vy, my jsme váš zpracovatel.',
          '**Technické údaje:** IP adresa, typ prohlížeče a bezpečnostní logy nezbytné pro provoz a ochranu služby.',
        ],
      },
      'Nepoužíváme reklamní ani sledovací cookies. Používáme jen nezbytné cookies pro přihlášení.',
    ],
  },
  {
    heading: '3. Účel a právní základ',
    body: [
      {
        list: [
          'Poskytování služby a plnění smlouvy (čl. 6 odst. 1 písm. b) GDPR).',
          'Zabezpečení, prevence zneužití a řešení incidentů – oprávněný zájem (písm. f).',
          'Plnění zákonných povinností, např. uchování dokladů (písm. c).',
        ],
      },
    ],
  },
  {
    heading: '4. Příjemci a zpracovatelé',
    body: [
      'Údaje zpracováváme u poskytovatelů infrastruktury: hosting (Vercel), databáze (Neon), odesílání e-mailů (Resend), případně dalších uvedených v aktuálním seznamu na GitHubu. Dotazy do veřejného rejstříku ARES odesíláme jen na vaši žádost (IČO). Údaje neprodáváme a nepředáváme k marketingu.',
    ],
  },
  {
    heading: '5. Přenosy mimo EU',
    body: [
      'Někteří poskytovatelé mohou zpracovávat údaje mimo EHP; děje se tak na základě standardních smluvních doložek nebo jiného mechanismu podle kapitoly V GDPR.',
    ],
  },
  {
    heading: '6. Doba uložení',
    body: [
      'Údaje uchováváme po dobu existence účtu. Po jeho smazání odstraníme data do 30 dnů, s výjimkou záloh (do 90 dnů) a údajů, které musíme uchovat ze zákona.',
    ],
  },
  {
    heading: '7. Vaše práva',
    body: [
      'Máte právo na přístup, opravu, výmaz, omezení zpracování, přenositelnost a vznést námitku. Žádosti (včetně exportu dat a smazání účtu – samoobslužné nástroje připravujeme) posílejte na kontakt výše. Máte také právo podat stížnost u Úřadu pro ochranu osobních údajů ([uoou.gov.cz](https://uoou.gov.cz)).',
    ],
  },
  {
    heading: '8. Zabezpečení',
    body: [
      'Data jsou přenášena šifrovaně (HTTPS), každý dotaz je izolován na úrovni vaší organizace a přístupy k API jsou chráněny klíči, které lze kdykoli zneplatnit.',
    ],
  },
  {
    heading: '9. Změny',
    body: [
      `Tyto zásady můžeme aktualizovat; aktuální znění je vždy na této stránce a historie změn v [repozitáři](${BRAND.repoUrl}).`,
    ],
  },
]
