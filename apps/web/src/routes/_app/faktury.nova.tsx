import { createFileRoute } from '@tanstack/react-router'
import { InvoiceForm } from '@/components/invoice-editor/invoice-form'
import { cs } from '@/i18n/cs'
import { pageHead } from '@/lib/head'

export const Route = createFileRoute('/_app/faktury/nova')({
  head: pageHead(cs.invoices.new),
  component: () => <InvoiceForm />,
})
