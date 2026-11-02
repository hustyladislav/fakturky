# Design v2 — from "basic" to crafted

Owner feedback (2026-11-02): "it looks really basic — iterate hard, page by page, component by component."
Review of all pages (`apps/web/.data/review/*`, 1440/390, light/dark) by the orchestrator.

## Diagnosis

The **PDF invoice is beautiful; the app is not.** The PDF has: uppercase micro-labels with tracking, hairline rules,
large serif figures, a strict grid, white paper. The app has: beige bordered cards on a beige background, everything
the same weight, centered narrow columns with empty margins, plain bar blocks, native browser date inputs, forms that
read like settings pages, an invoice detail that doesn't look like an invoice, no avatars, no motion, no data richness.

**Principle: bring the document's language into the app.** Every screen should feel like a well-set financial
document: paper sheets on a desk, micro-labels, hairlines, serif numbers, tabular figures, generous but purposeful space.

## Global foundations (packages/ui + app shell)

1. **Surfaces & depth.** Three layers: *desk* (`background` #F2EDE3 light / #0F100D dark, with a 2–3 % SVG noise
   grain), *sheet* (cards: #FFFEFB light / #1A1B17 dark, `box-shadow: 0 0 0 1px border, 0 1px 2px rgb(0 0 0 / .04),
   0 8px 24px -12px rgb(0 0 0 / .08)`), *popover* (stronger shadow). Sidebar sits on the desk (no card). Remove
   card-in-card nesting.
2. **Micro-label** utility (`.label-caps`): 11 px, 600, `letter-spacing: .08em`, uppercase, muted — used for every
   field label in read views, table headers, section eyebrows (exactly like the PDF).
3. **Hairline** utility and `Separator` with 1 px `border` color; section headers = micro-label + hairline.
4. **Figures.** `Amount` component: Geist Serif (single weight 400) for hero amounts (KPI, amount due), Inter `tnum` elsewhere; haléře dimmed;
   negative amounts in muted red with a minus sign, not alarming red unless overdue.
5. **PageHeader** component: Geist Serif title (28/32, weight 400), one-line context subtitle with live numbers ("32 dokladů ·
   94 985 Kč neuhrazeno"), right-aligned actions, optional tabs row beneath with counts. Used on every page.
6. **Avatar** with deterministic tinted initials (6 muted brand-compatible hues) for contacts and users.
7. **StatusBadge v2**: 6 px dot + label, soft tint background, consistent widths; overdue shows days ("14 dní po
   splatnosti"). **RelativeDate**: "za 5 dní", "dnes", "včera", "před 3 dny" with exact date in tooltip.
8. **Inputs**: replace native `type=date` with a shadcn Popover + Calendar (Czech locale, Monday first, presets
   7/14/30 as segmented control); currency = searchable combobox with flags/ISO codes; number inputs right-aligned
   tabular; selects never truncate ("21 %").
9. **Motion** (respect `prefers-reduced-motion`): View Transitions between routes (cross-fade + 8 px slide), KPI
   count-up on first paint, row hover lift (background tint + 1 px translate on actions), dialog/popover spring
   (scale .98→1, 140 ms), skeleton shimmer, "Zaplaceno" moment: logo dot fills + subtle success toast.
10. **Empty states**: line-art illustrations in brand style (single-weight strokes, forest-green accent) + one
    primary action + one sentence. Never a blank table.
11. **Sidebar**: top = organization switcher (business name + IČO, dropdown for other businesses), nav with counts
    (Faktury: overdue count badge), active item = sheet surface + 2 px accent bar; collapsible to icons (⌘\);
    footer: Kupte mi kávu · Zpětná vazba · user menu.
12. **Top bar**: breadcrumbs (Faktury / 2026-0028), wider search with recent items, theme toggle in user menu
    (free the top bar), "Nová faktura" split button (Prázdná / Ze šablony).
13. **Layout widths**: lists use full width (max 1280); detail/editor use two-column layouts; no narrow centered
    columns with dead margins at 1440.

## Pages

### Přehled (dashboard)
- Header: "Dobrý den" + date + summary sentence ("Tento měsíc jste vystavili 4 faktury za 92 400 Kč. 3 čekají na
  platbu.").
- KPI row (4): Obrat tento měsíc (with delta vs last month + sparkline), Neuhrazeno, Po splatnosti (count + oldest),
  Zaplaceno tento měsíc. Credit notes: show net turnover but explain negatives ("včetně dobropisů").
- Chart: real bar chart (custom SVG or a small lib — verify latest): stacked *zaplaceno* vs *nezaplaceno* per month,
  12 months toggle 6/12, y-axis gridlines with compact Czech labels (50 tis.), current month highlighted, tooltip on
  hover, empty months as faint baseline.
- "Čeká na platbu" list: avatar, client, number, due RelativeDate (red when overdue), amount, inline "Připomenout".
- VAT limit tracker (non-payers) as a progress bar with both thresholds marked.
- Quick actions: Nová faktura · Ze šablony · Nahrát výpis · Zeptat se asistenta (⌘J).
- Mobile: KPIs as horizontal snap carousel, chart compact, lists as cards; content padded above the bottom tab bar.

### Faktury (list)
- Summary strip under the header: segmented filter cards with counts and sums (Vše · Koncepty · Neuhrazené ·
  Po splatnosti · Zaplacené) replacing the plain tabs.
- Rows grouped by month with sticky month headers + month subtotal.
- Row: avatar + client (primary), number + type badge only for non-invoices (Zálohová, Dobropis) (secondary,
  mono), issue date, due RelativeDate, amount (right, bold tabular), StatusBadge v2; hover reveals quick actions
  (PDF, Označit jako zaplacenou, Duplikovat). Drafts show "Koncept" badge and no number.
- Sticky table header, sortable columns, bulk select (export, mark paid, send reminders), keyboard j/k + enter.
- Mobile: cards (client, amount, status, due).

### Nová faktura / úprava (editor)
- **Two-pane document editor** at ≥1280: left = editor laid out like the invoice (header "Faktura · číslo bude
  přiděleno při vystavení", Dodavatel/Odběratel side by side, dates row, items table, totals); right = **live A4
  paper preview** (the real HTML twin of the PDF, scaled, sticky) incl. QR. <1280: preview behind a "Náhled" toggle.
- Customer picker: large combobox card with recent customers as chips, ARES search inline, "Nový odběratel".
- Items: table with column headers (Popis, Množství, MJ, Cena, DPH, Celkem), inline totals per row, drag handle,
  "+ Přidat položku" row, Enter adds a row, ⌘⌫ deletes; description supports a second detail line.
- Texts collapsed under "Další možnosti" (úvodní text, poznámka, soukromá poznámka, objednávka, jazyk).
- **Sticky bottom action bar**: total due (Geist Serif), "Uložit koncept", "Vystavit" (⌘↵), unsaved-changes indicator.

### Faktura detail
- Two columns: left = **paper sheet** rendering of the actual document (same HTML twin as the editor preview, incl.
  QR Platba, logo, signature) with subtle shadow; right rail (sticky): status + amount due hero (Geist Serif), primary
  action, secondary actions, payment info (account, VS, QR), timeline (vertical, icons, who/when, "Označeno ručně" vs
  "Spárováno z banky"), related documents, public link.
- Mobile: hero (status, amount due, due date), QR card, collapsed document, sticky primary action.

### Kontakty
- Table with avatar, name + IČO (secondary), e-mail, **vyfakturováno celkem**, **neuhrazeno**, last invoice
  RelativeDate; row → **contact detail page** (new): header with avatar + ARES data, stats, invoices of this contact,
  notes, "Nová faktura pro …". Row actions in a "…" menu.

### Banka, DPH, Šablony, Nastavení, Onboarding, Auth, public `/f/:token`
- Same PageHeader, micro-labels, sheets. Banka: transaction rows with direction arrow icon, counterparty avatar,
  matched document chip. DPH: report as a document-like sheet with row numbers in micro-labels. Šablony: cards with
  next run date and preview. Onboarding: 3-step progress with ARES-filled business card preview. Auth: split layout
  with a product visual. Public invoice: paper sheet centered, QR + "Zaplatit" panel, download buttons.

## Process

Each page: implement → screenshot 1440/390 light/dark → self-critique against this doc → fix → PR with before/after
screenshots. The orchestrator reviews screenshots and sends a second round of notes per page.
