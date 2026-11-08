# Design system

Minimal, modern finance UI. Layout language measured from ramp.com in a real browser (2026-11-08), with our own accent
and open fonts; never Ramp's logo, Lausanne font, copy or imagery. Motion and mobile rules follow Emil Kowalski's
published skills (`emilkowalski/skills`: `emil-design-eng`, `mobile-native`).

## Principles

1. **Ink on white.** Near-black text, white surface, warm-grey bands. Colour carries meaning only.
2. **One regular weight for display.** Hierarchy from size and tight tracking, never bold headings.
3. **Hairlines, not boxes.** Group with space and 1 px rules; a panel is the exception. Never nest panels.
4. **The document is the product.** The PDF/web invoice keeps its own serif look (below); the app never uses serif.
5. **Fast hands.** Keyboard first on desktop (⌘K, N, /), thumb first on mobile.
6. **Status = dot or icon + text + colour**, never colour alone, no pill.

## Tokens

The only source is `packages/ui/src/styles/globals.css`; `apps/web/src/lib/design-rules.test.ts` fails on AA contrast
misses in either theme. Roles: `primary` = ink button (light on dark), `brand` = mint `#8FF0B6`, at most one per screen
for the single most important action, never a status. `accent` is the neutral hover fill. Status colours: `success`, `warning`,
`info`, `destructive`.

**Document status:** Koncept = muted · Vystavená = info · Po splatnosti = destructive · Částečně uhrazená = warning ·
Zaplacená = success · Stornovaná = muted, strikethrough.

## Typography

- **Inter Variable with optical sizing** (`opsz` axis: display cuts at large sizes), `tnum`, `lnum`, `cv11`.
- Display: weight 400, tracking −0.02 em. Page title 28/32; hero amount 40; marketing 64/64, 48/50, 40/42 (40/42 on phones).
- UI: 14 base, 13 secondary, 11 eyebrow (`label-caps`, 500, +0.04 em, uppercase, sparingly).
- **JetBrains Mono** only for IBAN, account numbers, VS, API keys, code. **Never for amounts.**
- Amounts: Czech format `148 500,00 Kč`, non-breaking spaces, haléře at 60 % opacity (`Amount`).

## Shape & density

Radius 6 px controls, 12 px panels and dialogs. Depth from hairlines; shadow only on floating layers. Controls 36 px,
44 px on coarse pointers (`pointer-coarse:`). Rows 40 px desktop, 44+ touch. Content max-width 1200 px. Icons lucide, 16 px.

## Motion

Before animating, ask how often it is seen:

| Frequency | Rule |
| --- | --- |
| Keyboard actions, ⌘K, 100+/day | No animation, ever |
| Row hover, route change, tens/day | Instant tint; page fades 140 ms, nothing travels |
| Popovers, dialogs, drawers, toasts | Standard: 150–250 ms, drawers 200–300 ms |
| Onboarding finish, first paid invoice | May delight |

- Curves are theme tokens: `ease-out`, `ease-in-out`, `ease-(--ease-drawer)`. Never `ease-in`, never `transition-all`.
- Press: `scale-[0.97]`, 150 ms. Enter from `scale(0.97)` + opacity, never 0. Exit faster than enter.
- Popovers grow from `var(--transform-origin)`; modals stay centred. Prefer transitions over keyframes for anything re-triggerable.
- Only `transform`/`opacity` for movement. Reduced motion keeps fades and drops travel.

## Mobile

Thumb-first single column, primary action in reach at the bottom. Platform layer lives in `globals.css`: no tap highlight,
`touch-action: manipulation`, 16 px fields on coarse pointers (no iOS zoom), `viewport-fit=cover` with `env(safe-area-*)`. Hover
only behind `hover:` (Tailwind gates it) or `@media (hover: hover) and (pointer: fine)`; press feedback via `:active`.
Use `dvh`/`svh`, not `vh`. Set `inputmode` and `enterkeyhint` on fields. Emulation misses sticky hover, safe areas and the keyboard: say so under Not verified.

## Logo

Rounded-square mark with the first letter of the brand + a period ("F."). One-colour version for PDFs. Generated from `BRAND.name`.

## User stories (what every screen is judged against)

1. **First invoice in under a minute:** sign up → IČO fills the business → add a customer by IČO → issue.
2. **Who owes me?** Overdue money is the first thing on Přehled, with a one-tap reminder.
3. **Bill the same client again:** two taps from the contact or the previous invoice.
4. **On the phone, one hand:** find an invoice, share its link, mark it paid.
5. **My customer pays:** public link, amount, QR code, nothing else competing.
6. **Quarter end:** VAT figures and exports without hunting.

## Shell

- Desktop: left sidebar, top bar with search (⌘K) and "Nová faktura" (N; hidden inside the editor), right AI panel (⌘J). Tablet: icon sidebar.
- Mobile: bottom tab bar (Přehled, Faktury, +, Kontakty, Více); the editor replaces "+" with its own action bar.

## Key screens

- **Přehled:** greeting without vocative ("Dobrý den"), then who owes money: Neuhrazeno and Po splatnosti as the largest
  figures, an aging strip, and "Čeká na platbu" with one-tap Připomenout. The month's Obrat and Zaplaceno sit beside
  them; a bar chart and recent documents follow. VAT payers get the next filing deadline; non-payers the turnover limit tracker.
- **New invoice:** one flat document (Odběratel → Položky → Platba, then "Další možnosti"), live A4 preview on the right
  (desktop ≥1280), sticky action bar with the total. ARES results grouped "Vaši odběratelé" / "Registr ARES", number and VS
  assigned at issue, weekend-due-date hint (computed, never hardcoded). "Vystavit" is the screen's one primary action;
  sending is a separate step with confirmation.
- **Invoice detail:** document preview, status timeline (Vytvořena → Vystavena → Odeslána → Zobrazena →
  Zaplacena), actions: Stáhnout PDF, Odeslat, Označit jako zaplacenou (full-width on mobile), Duplikovat,
  Vytvořit opravný doklad, Stornovat. "Označeno ručně" when payment wasn't matched from a bank.

## The invoice document (A4, PDF and `/f/:token`)

- White paper in both themes; black text; brand color only as thin rule + logo. **No white-on-dark boxes**, no
  color-only meaning — prints in grayscale and OCRs cleanly.
- Header: logo (optional), title by type and VAT status — "Faktura" (neplátce), "Faktura – daňový doklad" (plátce),
  "Zálohová faktura", "Opravný daňový doklad"/"Opravný doklad", "Daňový doklad k přijaté platbě" — and number in Geist Serif.
- Dodavatel / Odběratel columns with IČO, DIČ; registry note; "Neplátce DPH" or "Plátce DPH" consistent with profile.
- Dates block: Datum vystavení, Datum uskutečnění zdanitelného plnění (payers), Datum splatnosti; Forma úhrady.
- Payment block: account number, IBAN, BIC, VS, (KS), amount due, QR Platba (CZK) / EPC QR (EUR) with label.
- Items table: Popis, Množství, MJ, Cena za MJ, (DPH %), Celkem. Payers: VAT recap per rate (Základ, DPH, Celkem),
  CZK amounts + exchange rate line for foreign currency, rounding line if any, legal text for special treatments.
- Total: large Geist Serif figure on paper, framed by hairlines (not a filled box).
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
