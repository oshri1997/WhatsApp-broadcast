'use client';

import NumberFlow from '@number-flow/react';
import { clsx } from 'clsx';
import { useApp } from '@/lib/store';
import { CheckIcon, ClockIcon, PhoneIcon, QuestionIcon, UsersIcon, XIcon } from '@/components/icons';

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
      className="card rise-in flex flex-col gap-2 p-4"
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

  const invited = guests.filter((g) => g.invited);
  const yes = invited.filter((g) => g.rsvpStatus === 'yes');
  const no = invited.filter((g) => g.rsvpStatus === 'no');
  const maybe = invited.filter((g) => g.rsvpStatus === 'maybe');
  const pending = invited.filter((g) => !g.rsvpStatus);
  const people = yes.reduce((sum, g) => sum + (g.rsvpCount || 0), 0);
  const ready = accounts.filter((a) => a.status === 'READY').length;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Tile
        index={0}
        icon={<UsersIcon />}
        label="סה״כ מוזמנים"
        value={guests.length}
        sub={`${invited.length} כבר קיבלו הזמנה`}
        tone="brand"
      />
      <Tile
        index={1}
        icon={<CheckIcon />}
        label="מגיעים"
        value={yes.length}
        sub={`${people} אנשים בסך הכל`}
        tone="good"
      />
      <Tile index={2} icon={<XIcon />} label="לא מגיעים" value={no.length} tone="bad" />
      <Tile index={3} icon={<QuestionIcon />} label="אולי" value={maybe.length} tone="warn" />
      <Tile
        index={4}
        icon={<ClockIcon />}
        label="ממתינים לתשובה"
        value={pending.length}
        tone="neutral"
      />
      <Tile
        index={5}
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
