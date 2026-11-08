import { useId } from 'react'

/** A hairline-separated block of the rail: a small title, then its content. No panel around it. */
export function RailSection({
  title,
  testId,
  className,
  children,
}: {
  title: string
  testId?: string
  className?: string
  children: React.ReactNode
}) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} data-testid={testId} className={className}>
      <h2 id={titleId} className="label-caps">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}
