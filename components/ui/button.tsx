'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

const button = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)]',
    'font-medium select-none',
    // Only transform and opacity/colour move here — all compositor-friendly.
    'transition-[transform,background-color,border-color,color,opacity] duration-150 ease-snap',
    // Instant press feedback: the interface confirms it heard you before the
    // click even completes.
    'active:not-disabled:scale-[0.97]',
    'disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-linear-to-b from-brand to-brand-hover text-on-brand shadow-sm hover:not-disabled:brightness-110 dark:hover:not-disabled:brightness-105',
        secondary:
          'bg-surface-2 text-ink border border-line hover:not-disabled:bg-surface-hover hover:not-disabled:border-brand/30',
        ghost: 'text-muted hover:not-disabled:bg-surface-hover hover:not-disabled:text-ink',
        danger: 'bg-bad-soft text-bad border border-bad/25 hover:not-disabled:bg-bad/15',
      },
      size: {
        sm: 'h-8 px-3 text-[0.8125rem]',
        md: 'h-10 px-4 text-[0.9375rem]',
        icon: 'size-9 p-0',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = 'button', ...props },
  ref
) {
  return <button ref={ref} type={type} className={clsx(button({ variant, size }), className)} {...props} />;
});
