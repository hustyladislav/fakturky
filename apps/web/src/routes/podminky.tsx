import { BRAND } from '@fakturky/core/brand'
import { createFileRoute } from '@tanstack/react-router'
import { LegalPage } from '@/components/marketing/legal-page'
import { cs } from '@/i18n/cs'

export const Route = createFileRoute('/podminky')({
  head: () => ({ meta: [{ title: `${cs.legal.terms} — ${BRAND.name}` }] }),
  component: Terms,
})

function Terms() {
  return (
    <LegalPage title={cs.legal.terms} updated="1. 11. 2026">
      <h2>1. Úvod</h2>
      <p>
        Tyto podmínky upravují používání služby {BRAND.name} (dále jen „služba“), kterou zdarma a ve
        svém volném čase provozuje fyzická osoba (dále jen „provozovatel“). Používáním služby s
        podmínkami souhlasíte.
      </p>
      <h2>2. Co služba nabízí</h2>
      <p>
        Služba umožňuje vystavovat faktury a další doklady, spravovat kontakty a bankovní účty,
        generovat PDF a QR platby a přistupovat k datům přes webové rozhraní, API, MCP a příkazovou
        řádku. Zdrojový kód je veřejně dostupný na{' '}
        <a href={BRAND.repoUrl} target="_blank" rel="noreferrer">
          GitHubu
        </a>
        .
      </p>
      <h2>3. Cena a podpora</h2>
      <p>
        Služba je zdarma, bez omezení počtu faktur a kontaktů. Provoz lze dobrovolně podpořit darem;
        dar není protiplněním a nezakládá žádný nárok na funkce ani podporu.
      </p>
      <h2>4. Váš účet a vaše data</h2>
      <ul>
        <li>Za správnost zadaných údajů a obsah vystavených dokladů odpovídáte vy.</li>
        <li>
          Zabezpečte své přihlašovací údaje a API klíče; za jejich zneužití neneseme odpovědnost.
        </li>
        <li>
          Svá data můžete kdykoli exportovat a účet i s daty smazat. Faktury vystavené v minulosti
          však mohou podléhat vaší zákonné povinnosti uchování, kterou plníte vy.
        </li>
      </ul>
      <h2>5. Zakázané použití</h2>
      <p>
        Službu nesmíte používat k protiprávní činnosti, k narušování jejího provozu ani k
        automatizovanému hromadnému zneužívání (např. rozesílání nevyžádaných zpráv).
      </p>
      <h2>6. Žádná záruka</h2>
      <p>
        Službu poskytujeme „tak, jak je“. Snažíme se o správné výpočty (včetně DPH) a soulad s
        českými předpisy, nejde však o daňové ani právní poradenství. Před odevzdáním daňových
        přiznání či důležitých dokladů si údaje ověřte nebo je konzultujte s účetním.
      </p>
      <h2>7. Odpovědnost</h2>
      <p>
        Provozovatel neodpovídá za škody vzniklé používáním služby, výpadkem či ztrátou dat, s
        výjimkou případů, kdy odpovědnost nelze zákonem vyloučit. Doporučujeme data pravidelně
        exportovat.
      </p>
      <h2>8. Změny a ukončení</h2>
      <p>
        Služba i tyto podmínky se mohou měnit. O podstatných změnách vás budeme informovat v
        aplikaci nebo e-mailem. Provozovatel může službu kdykoli ukončit; v takovém případě vám
        umožní data exportovat.
      </p>
      <h2>9. Kontakt a rozhodné právo</h2>
      <p>
        Dotazy a hlášení problémů posílejte přes{' '}
        <a href={BRAND.issuesUrl} target="_blank" rel="noreferrer">
          GitHub Issues
        </a>{' '}
        nebo na [KONTAKTNÍ E-MAIL PROVOZOVATELE]. Vztahy se řídí právem České republiky.
      </p>
    </LegalPage>
  )
}
