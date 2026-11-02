# UI: shadcn/ui (Base UI) on Tailwind v4, Czech copy

Every new or touched screen is built from shadcn components (Base UI flavour, `base-nova` style). Use the `shadcn`
and `frontend-design` skills. Design system: [DESIGN.md](../DESIGN.md) (tokens, type, shell, the invoice document, Czech
copy) and its current iteration [DESIGN_V2.md](../DESIGN_V2.md) (surfaces, micro-labels, motion, page-by-page targets).
Reference visuals: `design/explorations/a-calm-editorial.html`, `b-crisp-product.html`.

## Where things live
- `packages/ui/src/components/*` — shadcn components restyled once to the project tokens, plus app primitives (`amount`, `avatar`, `empty-state`, `date-picker`, `currency-combobox`…). Add with `pnpm dlx shadcn@latest add <name>` from `apps/web` (config in `apps/web/components.json`); never `--overwrite` without reading the diff.
- `packages/ui/src/styles/globals.css` — the only theme file: tokens feed the shadcn roles and Tailwind's `@theme`, light and dark.
- `apps/web/src/i18n/cs.ts` — every user-facing string (typed). Documents (PDF/public page) also support `sk` and `en`.
- `apps/web/src/components`, `apps/web/src/routes` — screens.

## Rules
- Compose primitives before writing custom markup; variants before ad-hoc classes.
- Base UI, not Radix: custom triggers use `render={<Button />}` (not `asChild`). A link that looks like a button is a real `<Link>` with `className={buttonVariants(…)}` (`Button render={<Link />}` gets `role="button"`).
- Semantic colors only (`bg-primary`, `text-muted-foreground`, `bg-destructive/10`…). No raw hex in `className`; a missing role goes in the theme file.
- Status is icon + text + color, never color alone. Inputs have labels (tests use `getByLabel`). Brand green is never a status.
- Amounts: Czech format `148 500,00 Kč` with non-breaking spaces via the `Amount` component; JetBrains Mono only for IBAN/VS/keys, never for amounts.
- The product name is `BRAND` from `@fakturky/core/brand`, never a literal.

## Czech copy
- All strings live in `i18n/cs.ts`; no English leaking into the UI, no inline strings.
- Natural Czech with correct diacritics; **vykání** everywhere (including the founder's voice); standard Czech, no calques.
- Legal term once with a plain explanation beside it; fixed vocabulary: Obrat (not Tržby), Zaplacená / Neuhrazená, Odběratel / Dodavatel, Vystavit, Opravný doklad (glossary in [domain.md](domain.md)).
- No gendered participles or vocatives with names ("Dobrý den", "Letos celkem: …").
- State status, then next action; never celebrate money that wasn't verified ("Označeno jako zaplacené"). "Pro AI asistenty", never "pro agenty". "Kup mi kávu" never on success screens or modals.

## Proof
Before/after screenshots at 1440 and 390 px, light and dark, in the PR. Run the a11y e2e (axe, `apps/web/e2e/a11y.spec.ts`)
for touched pages. Wait for hydration and finished transitions before clicking or measuring in tests. Seed local demo data
with `pnpm db:seed` against a running `pnpm dev`.
