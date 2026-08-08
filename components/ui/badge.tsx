import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

const badge = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.75rem] font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        good: 'bg-good-soft text-good',
        bad: 'bg-bad-soft text-bad',
        warn: 'bg-warn-soft text-warn',
        neutral: 'bg-surface-2 text-muted border border-line',
        brand: 'bg-brand-soft text-brand-ink',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={clsx(badge({ tone }), className)} {...props} />;
}
