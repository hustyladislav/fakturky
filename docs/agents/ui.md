# UI: shadcn/ui (Base UI) on Tailwind v4, Czech copy

Every new or touched screen is built from shadcn components (Base UI flavour, `base-nova` style). Use the `shadcn`,
`frontend-design`, `emil-design-eng` and `mobile-native` skills (`review-animations` for a motion review). Design system: [DESIGN.md](../DESIGN.md) (tokens, type, motion, mobile, user stories, the invoice document, Czech copy).

## Where things live
- `packages/ui/src/components/*` — shadcn components restyled once to the project tokens, plus app primitives (`amount`, `avatar`, `empty-state`, `date-picker`, `currency-combobox`…). Add with `pnpm dlx shadcn@latest add <name>` from `apps/web` (config in `apps/web/components.json`); never `--overwrite` without reading the diff.
- `packages/ui/src/styles/globals.css` — the only theme file: tokens feed the shadcn roles and Tailwind's `@theme`, light and dark.
- `apps/web/src/i18n/cs.ts` — every user-facing string (typed). Documents (PDF/public page) also support `sk` and `en`.
- `apps/web/src/routes` — screens; `apps/web/src/components/<feature>/` — everything one feature owns: components, hooks, helpers and their tests. The `components/` root and `apps/web/src/lib` hold only what several features share.

## Rules
- Compose primitives before writing custom markup; variants before ad-hoc classes.
- Base UI, not Radix: custom triggers use `render={<Button />}` (not `asChild`). A link that looks like a button is a real `<Link>` with `className={buttonVariants(…)}` (`Button render={<Link />}` gets `role="button"`).
- Semantic colors only (`bg-primary`, `text-muted-foreground`, `bg-destructive/10`…). No raw hex in `className`; a missing role goes in the theme file.
- Status is dot or icon + text + color, never color alone. Inputs have labels (tests use `getByLabel`). `brand` mint is never a status.
- Motion and hover follow DESIGN.md → Motion; `apps/web/src/lib/design-rules.test.ts` fails on `transition-all`, `ease-in`, `scale(0)`, `font-serif` and AA contrast misses.
- Amounts: Czech format `148 500,00 Kč` with non-breaking spaces via the `Amount` component; JetBrains Mono only for IBAN/VS/keys, never for amounts.
- The product name is `BRAND` from `@fakturky/core/brand`, never a literal.
- A failed mutation shows a Czech toast by default (`createMutationCache`). Add `onError` only when the mutation reports the error itself, such as inline in a form.

## Czech copy
- All strings live in `i18n/cs.ts`; no English leaking into the UI, no inline strings.
- Natural Czech with correct diacritics; **vykání** everywhere (including the founder's voice); standard Czech, no calques.
- Legal term once with a plain explanation beside it; fixed vocabulary: Obrat (not Tržby), Zaplacená / Neuhrazená, Odběratel / Dodavatel, Vystavit, Opravný doklad (glossary in [domain.md](domain.md)).
- No gendered participles or vocatives with names ("Dobrý den", "Letos celkem: …").
- State status, then next action; never celebrate money that wasn't verified ("Označeno jako zaplacené"). "Pro AI asistenty", never "pro agenty". "Kup mi kávu" never on success screens or modals.

## Proof

[verification.md](verification.md) and [pr-evidence.md](pr-evidence.md). Run the a11y e2e (axe, `apps/web/e2e/a11y.spec.ts`) for touched pages. Wait for hydration and finished transitions before clicking or measuring in tests.
