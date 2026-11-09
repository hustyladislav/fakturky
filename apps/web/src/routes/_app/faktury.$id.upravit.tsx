import { createFileRoute } from '@tanstack/react-router'
import { InvoiceForm } from '@/components/invoice-editor/invoice-form'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'

export const Route = createFileRoute('/_app/faktury/$id/upravit')({
  head: pageHead(cs.invoices.form.titleEdit),
  component: () => <InvoiceForm id={Route.useParams().id} />,
})
