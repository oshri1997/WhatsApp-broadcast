'use client';

import * as React from 'react';
import { clsx } from 'clsx';
import { QuestionIcon } from '@/components/icons';

export function HelpTip({ children, label = 'מידע נוסף', className }: { children: React.ReactNode; label?: string; className?: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <span className={clsx('help-tip', open && 'is-open', className)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="help-tip__trigger" aria-label={label} aria-expanded={open} onClick={() => setOpen((current) => !current)} onBlur={() => setOpen(false)}>
        <QuestionIcon />
      </button>
      <span role="tooltip" className="help-tip__bubble">{children}</span>
    </span>
  );
}
