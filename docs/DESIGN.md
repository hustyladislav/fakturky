# Design system

Decided 2026-11-01 by a design council (3 directions in `design/explorations/`, reviewed by a design director and
a persona council: freelancer on a phone, developer power user, accountant). **Base: A "Calm editorial"**, with
B's product shell (⌘K, shortcuts, density, dark mode) and C's mobile flow. Reference visuals:
`design/explorations/a-calm-editorial.html` (brand, document), `b-crisp-product.html` (shell, ⌘K).

## Principles

1. **Calm and trustworthy.** Warm paper, near-black ink, one green that means _action_. No upsells, ever.
2. **The document is the product.** The PDF/web invoice is what clients and accountants see. It must be legally
   complete, unambiguous, grayscale-safe and beautiful.
3. **Fast hands.** Keyboard first on desktop (⌘K, N, /, G F…), thumb first on mobile (primary action full-width
   at the bottom).
4. **Status = icon + text + color**, never color alone.

## Tokens (shadcn names, Tailwind v4 `@theme` in `packages/ui/src/styles/globals.css`)

| Token                        | Light                                             | Dark                                              |
| ---------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| background                   | `#F6F2EA`                                         | `#121310`                                         |
| foreground                   | `#1B1A17`                                         | `#EEE9DD`                                         |
| card                         | `#FCFAF5`                                         | `#1A1B17`                                         |
| popover                      | `#FFFFFF`                                         | `#1F201B`                                         |
| primary / primary-foreground | `#1F4D3C` / `#F6F2EA`                             | `#8CC4A4` / `#0F1A14`                             |
| secondary, muted             | `#EFE9DD`                                         | `#1F201B`                                         |
| muted-foreground             | `#6B665B`                                         | `#9C978A`                                         |
| accent / accent-foreground   | `#E1EBE3` / `#1F4D3C`                             | `#1D2B24` / `#8CC4A4`                             |
| destructive                  | `#A12F22`                                         | `#E27B6A`                                         |
| border                       | `#E2DACB`                                         | `#2B2C26`                                         |
| input (≥3:1 for controls)    | `#9A917D`                                         | `#4A4B42`                                         |
| ring                         | primary @ 40 %                                    | primary @ 50 %                                    |
| chart-1…5                    | `#1F4D3C` `#B7791F` `#3F6E8C` `#A12F22` `#8A8472` | `#8CC4A4` `#E0A84F` `#8FB4D1` `#E27B6A` `#9C978A` |
| sidebar / sidebar-accent     | `#EFE9DD` / `#E4DDCD`                             | `#0E0F0C` / `#1D2B24`                             |
| success                      | `#2F6A2E`                                         | `#8FCB8A`                                         |
| warning                      | `#9A5B0B`                                         | `#E0A84F`                                         |
| info                         | `#2F5D7C`                                         | `#8FB4D1`                                         |

Soft tints for pills/badges use the semantic color at 10–14 % alpha, so they work in both themes.

**Document status:** Koncept = muted (`FileDashed`) · Vystavená = info (`Send`) · Po splatnosti = destructive
(`Clock`) · Částečně uhrazená = warning · Zaplacená = success (`Check`) · Stornovaná = muted, strikethrough.
Brand green is never a status.

## Typography

- **Inter** (UI, tables, body) with `font-feature-settings: "tnum", "lnum", "cv11"`. Self-hosted via Fontsource, `latin-ext`.
- **Fraunces** (opsz, 400–600, SOFT 0, WONK 0) only for: page titles, KPI amounts, document number and total on the
  invoice, the wordmark. Never for body text on mobile.
- **JetBrains Mono** only for IBAN, account numbers, VS, API keys, code. **Never for amounts.**
- Amounts: Czech format `148 500,00 Kč` with non-breaking spaces; the haléře part rendered at 60 % opacity in UI
  (not on the document). One notation per document (Kč for CZK, ISO code for others).
- Scale: 12 / 13 / 14 (base) / 16 / 20 / 24 / 32 / 44.

## Shape & density

Radius: 6 px inputs/pills, 8 px buttons, 12 px cards/dialogs (never more). Depth from 1 px hairlines; shadows only
on popovers/dialogs. Row height 40 px desktop, 44 px touch. Content max-width 1200 px; sidebar 240 px; AI panel 380 px.
Icons: lucide-react, 16 px in UI, 1.5 stroke.

## Logo

Rounded-square mark with the letter of the brand + a period ("F."). The dot is the one semantic, animatable
element: it fills when an invoice is paid (a restrained ~1 s moment — no confetti). Wordmark in Fraunces 600.
One-color version for PDFs. Generated from `BRAND.name`, so a rename only swaps the letter.

## Shell

- Desktop: left sidebar (Přehled, Faktury, Kontakty, Šablony, Nastavení; footer: Kup mi kávu, Zpětná vazba,
  account), top bar with search (⌘K) and "Nová faktura" (N). Right AI panel toggled with ⌘J.
- ⌘K palette groups: Akce, Přejít na, Nedávné, and "Zeptat se asistenta" when the query is a sentence.
- Shortcut hints shown in tooltips/buttons (`kbd`).
- Tablet: collapsible icon sidebar. Mobile: bottom tab bar (Přehled, Faktury, +, Kontakty, Více); the "+" opens
  the new-invoice flow as a full-screen sheet with a step-free single column.

## Key screens

- **Dashboard:** greeting without vocative ("Dobrý den"), KPI row (Obrat tento měsíc, Neuhrazeno, Po splatnosti),
  "Limit obratu pro registraci k DPH" tracker for non-payers, recent documents, monthly bar chart, one
  narrative nudge with inline action ("1 faktura je 5 dní po splatnosti — Připomenout").
- **New invoice:** flat cards (Odběratel → Údaje → Položky → Platba), live A4 preview on the right (desktop ≥1280),
  ARES results grouped "Vaši odběratelé" / "Registr ARES", auto number and VS marked "auto", DUZP labeled
  "DUZP (datum zdanitelného plnění)" with a hint, weekend-due-date hint (computed, never hardcoded), recurring
  toggle, "Uložit jako šablonu". Primary action "Vystavit"; sending is a separate step with confirmation.
- **Invoice detail:** document preview, status timeline (Vytvořena → Vystavena → Odeslána → Zobrazena →
  Zaplacena), actions: Stáhnout PDF, Odeslat, Označit jako zaplacenou (full-width on mobile), Duplikovat,
  Vytvořit opravný doklad, Stornovat. "Označeno ručně" when payment wasn't matched from a bank.

## The invoice document (A4, PDF and `/f/:token`)

- White paper in both themes; black text; brand color only as thin rule + logo. **No white-on-dark boxes**, no
  color-only meaning — prints in grayscale and OCRs cleanly.
- Header: logo (optional), title by type and VAT status — "Faktura" (neplátce), "Faktura – daňový doklad" (plátce),
  "Zálohová faktura", "Opravný daňový doklad"/"Opravný doklad", "Daňový doklad k přijaté platbě" — and number in Fraunces.
- Dodavatel / Odběratel columns with IČO, DIČ; registry note; "Neplátce DPH" or "Plátce DPH" consistent with profile.
- Dates block: Datum vystavení, Datum uskutečnění zdanitelného plnění (payers), Datum splatnosti; Forma úhrady.
- Payment block: account number, IBAN, BIC, VS, (KS), amount due, QR Platba (CZK) / EPC QR (EUR) with label.
- Items table: Popis, Množství, MJ, Cena za MJ, (DPH %), Celkem. Payers: VAT recap per rate (Základ, DPH, Celkem),
  CZK amounts + exchange rate line for foreign currency, rounding line if any, legal text for special treatments.
- Total: large Fraunces figure on paper, framed by hairlines (not a filled box).
- Footer: "Vystavil(a)", contact, page "Strana 1 / 1", small "Vystaveno ve {BRAND.name}" (removable in settings).
- Languages: cs, sk, en.

## Copy (Czech)

1. Vykání everywhere, including the founder's voice ("Kupte mi kávu").
2. Legal term once, plain explanation beside it; fixed vocabulary: Obrat (not Tržby) for the VAT limit,
   Zaplacená / Neuhrazená, Odběratel / Dodavatel, Vystavit, Opravný doklad.
3. Standard Czech, no calques ("A to je vše", "Upozorníme vás dřív").
4. No gendered participles or vocatives with names ("Letos celkem: …", "Dobrý den").
5. State status, then next action; never celebrate money that wasn't verified ("Označeno jako zaplacené").
6. "Pro AI asistenty", never "pro agenty". "Kup mi kávu" never appears on success screens or modals.

## AI assistant panel

380 px right panel on the muted surface (full-screen sheet on mobile). Built from shadcn chat components
(`message`, `bubble`, `message-scroller`, `input-group`, `item` for approvals, `trace` for tool calls). Agent
drafts land as "Koncept · navrhl asistent" with accept/reject; destructive tools show an approval card.
