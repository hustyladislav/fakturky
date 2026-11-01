import { BRAND } from '@fakturky/core/brand'
import { createFileRoute } from '@tanstack/react-router'
import { LegalPage } from '@/components/marketing/legal-page'
import { cs } from '@/i18n/cs'

export const Route = createFileRoute('/soukromi')({
  head: () => ({ meta: [{ title: `${cs.legal.privacy} — ${BRAND.name}` }] }),
  component: Privacy,
})

function Privacy() {
  return (
    <LegalPage title={cs.legal.privacy} updated="1. 11. 2026">
      <h2>1. Správce osobních údajů</h2>
      <p>
        Správcem je provozovatel služby {BRAND.name}, fyzická osoba: [JMÉNO A PŘÍJMENÍ, ADRESA,
        KONTAKTNÍ E-MAIL]. Správce není povinen jmenovat pověřence pro ochranu osobních údajů.
      </p>
      <h2>2. Jaké údaje zpracováváme</h2>
      <ul>
        <li>
          <strong>Údaje o účtu:</strong> jméno, e-mail, přihlašovací údaje (heslo ukládáme pouze
          jako hash; případně klíče přístupu / přihlášení přes poskytovatele).
        </li>
        <li>
          <strong>Obsah, který vložíte:</strong> údaje o vaší firmě, kontakty vašich odběratelů,
          faktury, bankovní účty. K údajům o vašich odběratelích jste správcem vy, my jsme váš
          zpracovatel.
        </li>
        <li>
          <strong>Technické údaje:</strong> IP adresa, typ prohlížeče a bezpečnostní logy nezbytné
          pro provoz a ochranu služby.
        </li>
      </ul>
      <p>
        Nepoužíváme reklamní ani sledovací cookies. Používáme jen nezbytné cookies pro přihlášení.
      </p>
      <h2>3. Účel a právní základ</h2>
      <ul>
        <li>Poskytování služby a plnění smlouvy (čl. 6 odst. 1 písm. b) GDPR).</li>
        <li>Zabezpečení, prevence zneužití a řešení incidentů – oprávněný zájem (písm. f).</li>
        <li>Plnění zákonných povinností, např. uchování dokladů (písm. c).</li>
      </ul>
      <h2>4. Příjemci a zpracovatelé</h2>
      <p>
        Údaje zpracováváme u poskytovatelů infrastruktury: hosting (Vercel), databáze (Neon),
        odesílání e-mailů (Resend), případně dalších uvedených v aktuálním seznamu na GitHubu.
        Dotazy do veřejného rejstříku ARES odesíláme jen na vaši žádost (IČO). Údaje neprodáváme a
        nepředáváme k marketingu.
      </p>
      <h2>5. Přenosy mimo EU</h2>
      <p>
        Někteří poskytovatelé mohou zpracovávat údaje mimo EHP; děje se tak na základě standardních
        smluvních doložek nebo jiného mechanismu podle kapitoly V GDPR.
      </p>
      <h2>6. Doba uložení</h2>
      <p>
        Údaje uchováváme po dobu existence účtu. Po jeho smazání odstraníme data do 30 dnů, s
        výjimkou záloh (do 90 dnů) a údajů, které musíme uchovat ze zákona.
      </p>
      <h2>7. Vaše práva</h2>
      <p>
        Máte právo na přístup, opravu, výmaz, omezení zpracování, přenositelnost a vznést námitku.
        Data můžete exportovat a účet smazat v aplikaci; ostatní žádosti pošlete na kontakt výše.
        Máte také právo podat stížnost u Úřadu pro ochranu osobních údajů (
        <a href="https://uoou.gov.cz" target="_blank" rel="noreferrer">
          uoou.gov.cz
        </a>
        ).
      </p>
      <h2>8. Zabezpečení</h2>
      <p>
        Data jsou přenášena šifrovaně (HTTPS), každý dotaz je izolován na úrovni vaší organizace a
        přístupy k API jsou chráněny klíči, které lze kdykoli zneplatnit.
      </p>
      <h2>9. Změny</h2>
      <p>
        Tyto zásady můžeme aktualizovat; aktuální znění je vždy na této stránce a historie změn v{' '}
        <a href={BRAND.repoUrl} target="_blank" rel="noreferrer">
          repozitáři
        </a>
        .
      </p>
    </LegalPage>
  )
}
