'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import type { ResolvedGuest } from '@/lib/types';
import { apiJson, api, run, useApp } from '@/lib/store';
import { isSendable } from '@/lib/guests';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Label, Textarea } from '@/components/ui/field';
import { useConfirm } from '@/components/ui/confirm';
import { PencilIcon, TrashIcon } from '@/components/icons';

function Editor({ guest, onClose }: { guest: ResolvedGuest; onClose: () => void }) {
  const replaceGuest = useApp((s) => s.replaceGuest);
  const [name, setName] = React.useState(guest.name);
  const [phone, setPhone] = React.useState(guest.phoneRaw || guest.phone || '');
  const [side, setSide] = React.useState(guest.side || '');
  const [customMessage, setCustomMessage] = React.useState(guest.customMessage || '');
  const [saving, setSaving] = React.useState(false);

  const save = async (message: string) => {
    setSaving(true);
    const result = await run(() =>
      apiJson<{ guest: ResolvedGuest }>(`/api/guests/${guest.id}`, 'PATCH', {
        name,
        phone,
        side,
        customMessage: message,
      })
    );
    setSaving(false);
    if (!result) return;
    replaceGuest(result.guest);
    onClose();
    toast.success('המוזמן עודכן');
  };

  return (
    <div className="grid gap-4 border-t border-line bg-surface-2 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor={`name-${guest.id}`}>שם</Label>
          <Input
            id={`name-${guest.id}`}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`phone-${guest.id}`}>טלפון</Label>
          <Input
            id={`phone-${guest.id}`}
            value={phone}
            inputMode="tel"
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`side-${guest.id}`}>צד</Label>
          <Input
            id={`side-${guest.id}`}
            value={side}
            list="account-labels"
            onChange={(e) => setSide(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`msg-${guest.id}`}>הודעה אישית (אם ריק — תישלח ההודעה הכללית)</Label>
        <Textarea
          id={`msg-${guest.id}`}
          rows={3}
          value={customMessage}
          placeholder={`הודעה אישית ל${guest.name}`}
          onChange={(e) => setCustomMessage(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" disabled={saving} onClick={() => save(customMessage)}>
          שמירה
        </Button>
        {guest.customMessage && (
          <Button
            size="sm"
            variant="secondary"
            disabled={saving}
            onClick={() => {
              setCustomMessage('');
              save('');
            }}
          >
            חזרה להודעה הכללית
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={saving} onClick={onClose}>
          ביטול
        </Button>
      </div>
    </div>
  );
}

export function GuestRow({
  guest,
  multipleAccounts,
}: {
  guest: ResolvedGuest;
  multipleAccounts: boolean;
}) {
  const selected = useApp((s) => s.selected.has(guest.id));
  const toggleGuest = useApp((s) => s.toggleGuest);
  const editingGuestId = useApp((s) => s.editingGuestId);
  const setEditingGuestId = useApp((s) => s.setEditingGuestId);
  const refreshGuests = useApp((s) => s.refreshGuests);
  const confirm = useConfirm();

  const editing = editingGuestId === guest.id;
  const sendable = isSendable(guest, multipleAccounts);

  const sideCell = guest.resolvedAccountId ? (
    <span className="text-muted">{guest.resolvedAccountLabel}</span>
  ) : guest.side ? (
    <Badge tone="warn">⚠ ״{guest.side}״ לא מזוהה</Badge>
  ) : multipleAccounts ? (
    <Badge tone="warn">⚠ לא הוגדר צד</Badge>
  ) : null;

  return (
    <li
      className={`overflow-hidden transition-colors duration-150 ${
        editing ? 'bg-surface-2' : 'hover:bg-surface-hover'
      }`}
    >
      <div className="guest-row px-3 py-2.5">
        <input
          type="checkbox"
          checked={selected}
          disabled={!sendable}
          aria-label={`בחירת ${guest.name}`}
          onChange={(e) => toggleGuest(guest.id, e.target.checked)}
          className="size-4 shrink-0 accent-[var(--brand)] disabled:opacity-40"
        />

        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{guest.name}</div>
          {/* Phone and side get their own columns from `sm` up. */}
          <div dir="ltr" className="truncate text-start text-[0.8125rem] text-muted list:hidden">
            {guest.phoneRaw || guest.phone || ''}
            {guest.resolvedAccountLabel ? ` · ${guest.resolvedAccountLabel}` : ''}
          </div>
          {/* The side warning is what blocks sending, so it can't be a
              desktop-only column. */}
          {!guest.resolvedAccountId && sideCell && <div className="mt-1 list:hidden">{sideCell}</div>}
          {!guest.valid && <span className="text-[0.75rem] text-bad">מספר לא תקין</span>}
          {guest.customMessage && (
            <span className="text-[0.75rem] text-brand-ink">הודעה אישית</span>
          )}
        </div>

        <div
          dir="ltr"
          className="hidden truncate text-end text-[0.875rem] text-muted tabular-nums list:block"
        >
          {guest.phoneRaw || guest.phone || ''}
        </div>

        <div className="hidden min-w-0 truncate text-[0.875rem] list:block">{sideCell}</div>

        <div className="flex shrink-0 gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label={`עריכת ${guest.name}`}
            aria-expanded={editing}
            onClick={() => setEditingGuestId(editing ? null : guest.id)}
          >
            <PencilIcon className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`מחיקת ${guest.name}`}
            className="text-muted hover:not-disabled:text-bad"
            onClick={async () => {
              const ok = await confirm({
                title: `למחוק את ${guest.name} מהרשימה?`,
                description: 'אפשר תמיד להוסיף מחדש ידנית או להעלות אקסל שוב.',
                confirmLabel: 'מחיקה',
                tone: 'danger',
              });
              if (!ok) return;
              await run(() => api(`/api/guests/${guest.id}`, { method: 'DELETE' }));
              await refreshGuests();
            }}
          >
            <TrashIcon className="size-4" />
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {editing && (
          <motion.div
            key="editor"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.32 }}
            className="overflow-hidden"
          >
            <Editor guest={guest} onClose={() => setEditingGuestId(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
