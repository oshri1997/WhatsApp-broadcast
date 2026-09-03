'use client';

import NumberFlow from '@number-flow/react';
import { clsx } from 'clsx';
import { useApp } from '@/lib/store';
import { CheckIcon, PhoneIcon, UsersIcon } from '@/components/icons';

type Tone = 'brand' | 'good' | 'bad' | 'warn' | 'neutral';

const toneRing: Record<Tone, string> = {
  brand: 'text-brand-ink bg-brand-soft',
  good: 'text-good bg-good-soft',
  bad: 'text-bad bg-bad-soft',
  warn: 'text-warn bg-warn-soft',
  neutral: 'text-muted bg-surface-2',
};

function Tile({
  icon,
  label,
  value,
  sub,
  tone = 'neutral',
  index,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  tone?: Tone;
  index: number;
}) {
  return (
    <div
      className="stat-tile card rise-in flex flex-col gap-2 p-4"
      // Short stagger (45ms) so the row cascades in without feeling slow.
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div className="flex items-center gap-2">
        <span className={clsx('grid size-7 place-items-center rounded-lg text-[0.9rem]', toneRing[tone])}>
          {icon}
        </span>
        <span className="text-[0.8125rem] font-medium text-muted">{label}</span>
      </div>
      <NumberFlow
        value={value}
        locales="he-IL"
        className="text-[1.75rem] font-semibold tabular-nums"
        style={{ letterSpacing: '-0.02em' }}
      />
      <span className="min-h-4 text-[0.75rem] text-muted">{sub ?? ''}</span>
    </div>
  );
}

export function StatTiles() {
  const guests = useApp((s) => s.guests);
  const accounts = useApp((s) => s.accounts);

  const valid = guests.filter((g) => g.valid).length;
  const ready = accounts.filter((a) => a.status === 'READY').length;

  return (
    <div className="stats-grid grid grid-cols-2 gap-3 md:grid-cols-3">
      <Tile
        index={0}
        icon={<UsersIcon />}
        label="סה״כ מוזמנים"
        value={guests.length}
        sub="ברשימת התפוצה"
        tone="brand"
      />
      <Tile
        index={1}
        icon={<CheckIcon />}
        label="ניתן לשלוח אליהם"
        value={valid}
        sub={valid === guests.length ? 'כל המספרים תקינים' : `${guests.length - valid} דורשים תיקון`}
        tone="good"
      />
      <Tile
        index={2}
        icon={<PhoneIcon />}
        label="חיבורי וואטסאפ"
        value={ready}
        sub={
          accounts.length === 0
            ? 'מתחבר...'
            : ready === accounts.length
              ? 'הכל מחובר'
              : `מתוך ${accounts.length} · יש חיבור שלא מחובר`
        }
        tone={accounts.length > 0 && ready === accounts.length ? 'good' : 'warn'}
      />
    </div>
  );
}
