import { createFileRoute } from '@tanstack/react-router'
import { InvoiceForm } from '@/components/invoice-form'

export const Route = createFileRoute('/_app/faktury/$id/upravit')({
  component: () => <InvoiceForm id={Route.useParams().id} />,
})
