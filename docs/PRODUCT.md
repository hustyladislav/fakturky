# Product scope

Free forever, no limits on invoices, contacts, bank accounts, currencies, recurring invoices or API calls.
Funded by donations (Buy Me a Coffee). Czech UI. Target: OSVČ and small s.r.o., later Slovakia.

## MVP (ship first, then iterate)

Sign up → business profile (IČO via ARES) → bank account (CZ number → IBAN, or any IBAN) → contact (ARES) →
invoice with lines (non-payer and VAT payer) → issue (number allocated) → PDF with QR Platba → public link →
mark paid. Deployed to production. Everything else below lands in small follow-up PRs.

## v1 (must ship)

1. **Onboarding** — sign up (email+password / passkey), create business by IČO (ARES autofill), choose VAT status,
   add first bank account (Czech number → IBAN auto, or any IBAN), pick numbering format. < 60 s to first invoice.
2. **Contacts** — unlimited; ARES lookup by IČO and by name; VIES check; per-contact defaults; archive; search.
3. **Invoices** — create/edit/duplicate; drafts; issue (allocates number); line items with qty, unit, price,
   VAT rate/treatment, discount; invoice-level discount; prices with/without VAT; any ISO currency with ČNB rate;
   document language cs/sk/en; texts (intro, footer, private note); order number; VS/KS.
4. **Proformas** → mark paid → payment receipt → final invoice. **Credit notes** from an invoice. **Storno**.
5. **Payments** — mark paid (full/partial, date, method); status lifecycle; overdue detection.
6. **Document output** — beautiful PDF (A4) with QR Platba / EPC QR, logo, signature; public web invoice
   `/f/:token` with download PDF + ISDOC; ISDOC export.
7. **Templates & recurring** — save as template, one-click "use"; recurring rules (monthly/quarterly/yearly),
   auto-issue and optionally auto-send. Unlimited.
8. **Email** — send invoice (PDF attached + link), reminders before/after due date, editable templates
   (requires email provider; feature-flagged).
9. **Dashboard** — revenue this month/year, unpaid, overdue, VAT-registration turnover tracker, recent documents,
   monthly chart.
10. **Settings** — business profile, VAT status, bank accounts, numbering series, appearance (accent color, logo,
    signature), defaults, email templates, API keys, members (accountant read-only later).
11. **Data** — CSV export, full JSON export, import contacts from CSV / Fakturoid export.
12. **Agents** — REST API + OpenAPI docs, MCP server (OAuth + API key) with every operation, CLI `fakturky`,
    `llms.txt`.
13. **Asistent** — Linear-style AI agent (⌘K + side panel) that can do everything in the app and navigate it;
    latest DeepSeek Flash (V4.1) via Vercel AI Gateway, US-hosted with zero data retention, hard $100/month global spend cap, per-org caps.
14. **Support & feedback** — "Kup mi kávu" link (buymeacoffee.com/ladislavhusty), feedback link, GitHub issues.
15. **Fast & responsive** — keyboard shortcuts (N = new invoice, / = search, ⌘K command palette), mobile layout.

## Later

Expenses + receipt OCR, price list, estimates, Fio/CSV bank pairing, Pohoda XML export, VAT reports
(přiznání, kontrolní hlášení), Slovak market (Pay by square, SK VAT, Peppol), multi-user roles, GoPay/Stripe
payment links, webhooks, accountant portal.
