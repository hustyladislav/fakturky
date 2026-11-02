import { cn } from 'cn'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker, getDefaultClassNames } from 'react-day-picker'
import { cs } from 'react-day-picker/locale'

const navButton =
  'inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground'

/** Czech calendar, Monday first, styled with the design tokens. */
function Calendar({ className, classNames, ...props }: React.ComponentProps<typeof DayPicker>) {
  const d = getDefaultClassNames()
  return (
    <DayPicker
      locale={cs}
      weekStartsOn={1}
      showOutsideDays
      className={cn('p-1', className)}
      classNames={{
        root: cn(d.root, 'text-sm'),
        months: cn(d.months, 'relative flex flex-col gap-4'),
        month: cn(d.month, 'flex w-full flex-col gap-3'),
        month_caption: cn(d.month_caption, 'flex h-8 items-center justify-center px-8'),
        caption_label: cn(d.caption_label, 'font-serif text-[15px] capitalize'),
        nav: cn(d.nav, 'absolute inset-x-0 top-0 flex items-center justify-between'),
        button_previous: cn(d.button_previous, navButton),
        button_next: cn(d.button_next, navButton),
        month_grid: cn(d.month_grid, 'w-full border-collapse'),
        weekday: cn(d.weekday, 'label-caps h-8 w-9 text-center'),
        day: cn(d.day, 'p-0 text-center'),
        day_button: cn(
          d.day_button,
          'inline-flex size-9 items-center justify-center rounded-md tabular-nums transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
        ),
        selected: cn(
          d.selected,
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
        ),
        today: cn(d.today, '[&>button]:font-semibold [&>button]:ring-1 [&>button]:ring-border'),
        outside: cn(d.outside, 'text-muted-foreground/50'),
        disabled: cn(d.disabled, 'opacity-40'),
        hidden: cn(d.hidden, 'invisible'),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: c }) =>
          orientation === 'left' ? (
            <ChevronLeft className={cn('size-4', c)} />
          ) : (
            <ChevronRight className={cn('size-4', c)} />
          ),
      }}
      {...props}
    />
  )
}

export { Calendar }
