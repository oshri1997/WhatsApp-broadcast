'use client';

import * as React from 'react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import type { ResolvedGuest, RsvpFilter } from '@/lib/types';
import { api, apiJson, hasMultipleAccounts, run, useApp } from '@/lib/store';
import { isSendable, matchesRsvpFilter, matchesSearch } from '@/lib/guests';
import { REMINDER_TEMPLATE } from '@/lib/templates';
import { Button } from '@/components/ui/button';
import { Hint, Input } from '@/components/ui/field';
import { useConfirm } from '@/components/ui/confirm';
import { GuestRow } from '@/components/guest-row';
import {
  BellIcon,
  DownloadIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UploadIcon,
} from '@/components/icons';

const FILTERS: { value: RsvpFilter; label: string }[] = [
  { value: '', label: 'הכל' },
  { value: 'yes', label: 'מגיעים' },
  { value: 'no', label: 'לא מגיעים' },
  { value: 'maybe', label: 'אולי' },
  { value: 'pending', label: 'ממתינים' },
  { value: 'not-invited', label: 'טרם נשלח' },
];

function ExcelImport() {
  const setGuests = useApp((s) => s.setGuests);
  const [file, setFile] = React.useState<File | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const upload = async (selected: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', selected);
    const result = await run(() =>
      api<{ guests: ResolvedGuest[] }>('/api/upload', { method: 'POST', body: formData })
    );
    setUploading(false);
    if (!result) return;
    setGuests(result.guests);
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
    toast.success(`נטענו ${result.guests.length} מוזמנים מהקובץ`);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) upload(dropped);
      }}
      className={clsx(
        'flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed p-6 text-center transition-colors duration-150',
        dragging ? 'border-brand bg-brand-soft' : 'border-line bg-surface-2'
      )}
    >
      <UploadIcon className="size-6 text-brand" />
      <p className="text-sm font-medium">גררו לכאן קובץ אקסל, או בחרו קובץ</p>
      <Hint>
        נדרשות העמודות <strong>שם המוזמן</strong> ו-<strong>מספר טלפון</strong>, ואופציונלית{' '}
        <strong>צד</strong>. טעינת קובץ מחליפה את הרשימה הקיימת.
      </Hint>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          aria-label="קובץ אקסל של המוזמנים"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="max-w-56 text-[0.8125rem] text-muted file:me-2 file:cursor-pointer file:rounded-[var(--radius-control)] file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-[0.8125rem] file:font-medium file:text-ink"
        />
        <Button variant="primary" size="sm" disabled={!file || uploading} onClick={() => file && upload(file)}>
          {uploading ? 'טוען…' : 'העלאה'}
        </Button>
      </div>
    </div>
  );
}

function AddGuestForm() {
  const addGuest = useApp((s) => s.addGuest);
  const accounts = useApp((s) => s.accounts);
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [side, setSide] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const nameRef = React.useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error('יש להזין שם ומספר טלפון');
      return;
    }
    setSaving(true);
    const result = await run(() =>
      apiJson<{ guest: ResolvedGuest }>('/api/guests', 'POST', { name, phone, side })
    );
    setSaving(false);
    if (!result) return;
    addGuest(result.guest);
    setName('');
    setPhone('');
    setSide('');
    nameRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit();
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Input
        ref={nameRef}
        value={name}
        placeholder="שם המוזמן"
        aria-label="שם המוזמן"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={onKeyDown}
        className="min-w-36 flex-[2]"
      />
      <Input
        value={phone}
        placeholder="מספר טלפון"
        aria-label="מספר טלפון"
        inputMode="tel"
        onChange={(e) => setPhone(e.target.value)}
        onKeyDown={onKeyDown}
        className="min-w-32 flex-1"
      />
      {accounts.length > 1 && (
        <Input
          value={side}
          placeholder="צד"
          aria-label="צד"
          list="account-labels"
          onChange={(e) => setSide(e.target.value)}
          onKeyDown={onKeyDown}
          className="min-w-24 flex-1"
        />
      )}
      <Button variant="secondary" onClick={submit} disabled={saving}>
        <PlusIcon className="size-4" />
        הוספה
      </Button>
    </div>
  );
}

export function GuestsPanel({ onGoToCompose }: { onGoToCompose: () => void }) {
  const guests = useApp((s) => s.guests);
  const accounts = useApp((s) => s.accounts);
  const selectedCount = useApp((s) => s.selected.size);
  const search = useApp((s) => s.search);
  const setSearch = useApp((s) => s.setSearch);
  const rsvpFilter = useApp((s) => s.rsvpFilter);
  const setRsvpFilter = useApp((s) => s.setRsvpFilter);
  const selectVisible = useApp((s) => s.selectVisible);
  const clearSelection = useApp((s) => s.clearSelection);
  const selectPendingReplies = useApp((s) => s.selectPendingReplies);
  const setMessage = useApp((s) => s.setMessage);
  const refreshGuests = useApp((s) => s.refreshGuests);
  const confirm = useConfirm();

  const multipleAccounts = hasMultipleAccounts(accounts);
  const visible = guests.filter(
    (g) => matchesSearch(g, search) && matchesRsvpFilter(g, rsvpFilter)
  );
  const sendableCount = guests.filter((g) => isSendable(g, multipleAccounts)).length;

  const remindPending = async () => {
    const count = selectPendingReplies();
    if (count === 0) {
      toast.info('אין כרגע מוזמנים שממתינים לתשובה');
      return;
    }
    setMessage(REMINDER_TEMPLATE.text);
    toast.success(`נבחרו ${count} מוזמנים ונטענה תבנית התזכורת`);
    onGoToCompose();
  };

  return (
    <div className="flex flex-col gap-5">
      <datalist id="account-labels">
        {accounts.map((a) => (
          <option key={a.id} value={a.label} />
        ))}
      </datalist>

      <ExcelImport />
      <AddGuestForm />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <SearchIcon className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted" />
            <Input
              value={search}
              placeholder="חיפוש לפי שם או טלפון…"
              aria-label="חיפוש מוזמנים"
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
          <Button size="sm" variant="secondary" onClick={selectVisible}>
            בחירת הנראים
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            ניקוי בחירה
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((filter) => {
            const active = rsvpFilter === filter.value;
            return (
              <button
                key={filter.value || 'all'}
                type="button"
                onClick={() => setRsvpFilter(filter.value)}
                aria-pressed={active}
                className={clsx(
                  'rounded-full border px-3 py-1 text-[0.8125rem] font-medium transition-[background-color,color,border-color,transform] duration-150 ease-snap active:scale-[0.97]',
                  active
                    ? 'border-brand bg-brand text-on-brand'
                    : 'border-line bg-surface text-muted hover:bg-surface-hover hover:text-ink'
                )}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.8125rem] text-muted">
            נבחרו <strong className="text-ink tabular-nums">{selectedCount}</strong> מתוך{' '}
            <span className="tabular-nums">{sendableCount}</span> שניתן לשלוח אליהם
          </span>
          <div className="ms-auto flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={remindPending}>
              <BellIcon className="size-4" />
              תזכורת לממתינים
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                window.location.href = '/api/guests/export';
              }}
            >
              <DownloadIcon className="size-4" />
              ייצוא לאקסל
            </Button>
            {guests.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted hover:not-disabled:text-bad"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'לנקות את כל רשימת המוזמנים?',
                    description: `${guests.length} מוזמנים יימחקו, כולל אישורי ההגעה שהתקבלו. כדאי לייצא לאקסל קודם.`,
                    confirmLabel: 'ניקוי הרשימה',
                    tone: 'danger',
                  });
                  if (!ok) return;
                  await run(() => api('/api/guests', { method: 'DELETE' }));
                  await refreshGuests({ resetSelection: true });
                  toast.success('הרשימה נוקתה');
                }}
              >
                <TrashIcon className="size-4" />
                ניקוי
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="guest-head border-b border-line bg-surface-2 px-3 py-2 text-[0.75rem] font-medium text-muted">
          <span />
          <span>שם המוזמן</span>
          <span>טלפון</span>
          <span>צד</span>
          <span>אישור הגעה</span>
          <span />
        </div>

        {visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">
            {guests.length === 0
              ? 'עדיין אין מוזמנים — העלו קובץ אקסל או הוסיפו מוזמן ידנית.'
              : 'אין מוזמנים שמתאימים לחיפוש או לסינון הנוכחי.'}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((guest) => (
              <GuestRow key={guest.id} guest={guest} multipleAccounts={multipleAccounts} />
            ))}
          </ul>
        )}
      </div>

      <Hint>
        אחרי כל הזמנה שנשלחת יוצאת אוטומטית הודעת המשך עם שאלת אישור הגעה (כן / לא / אולי), והתשובות
        מתעדכנות כאן אוטומטית כשהמוזמנים משיבים בוואטסאפ.
      </Hint>
    </div>
  );
}
