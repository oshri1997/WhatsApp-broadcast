'use client';

import * as React from 'react';
import { toast } from 'sonner';
import type { AccountStatus, AccountView } from '@/lib/types';
import { api, apiJson, run, useApp } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input, Hint } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { useConfirm } from '@/components/ui/confirm';
import { LinkOffIcon, PlusIcon, TrashIcon } from '@/components/icons';

const STATUS: Record<AccountStatus, { label: string; tone: 'good' | 'warn' | 'bad' | 'neutral' }> = {
  READY: { label: 'מחובר', tone: 'good' },
  QR: { label: 'ממתין לסריקת QR', tone: 'warn' },
  AUTHENTICATED: { label: 'מתחבר…', tone: 'neutral' },
  INITIALIZING: { label: 'מאתחל…', tone: 'neutral' },
  DISCONNECTED: { label: 'מנותק', tone: 'bad' },
};

function StatusDot({ status }: { status: AccountStatus }) {
  const tone = STATUS[status].tone;
  return (
    <span className="relative flex size-2.5">
      {status === 'READY' && (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-good opacity-60" />
      )}
      <span
        className={`relative inline-flex size-2.5 rounded-full ${
          tone === 'good'
            ? 'bg-good'
            : tone === 'warn'
              ? 'bg-warn'
              : tone === 'bad'
                ? 'bg-bad'
                : 'bg-muted'
        }`}
      />
    </span>
  );
}

function AccountCard({ account, index, canRemove }: { account: AccountView; index: number; canRemove: boolean }) {
  const refreshAccounts = useApp((s) => s.refreshAccounts);
  const confirm = useConfirm();
  const [label, setLabel] = React.useState(account.label);
  const [busy, setBusy] = React.useState(false);

  // The account list polls every couple of seconds; adopt server-side renames
  // only while this input isn't the thing being typed into.
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (document.activeElement !== inputRef.current) setLabel(account.label);
  }, [account.label]);

  const commitLabel = async () => {
    if (label.trim() === account.label || !label.trim()) {
      setLabel(account.label);
      return;
    }
    await run(async () => {
      await apiJson(`/api/accounts/${account.id}`, 'PATCH', { label });
      await refreshAccounts();
      toast.success('שם החיבור עודכן');
    });
  };

  const status = STATUS[account.status];

  return (
    <div className="card rise-in flex flex-col gap-3 p-4" style={{ animationDelay: `${index * 45}ms` }}>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          ref={inputRef}
          value={label}
          aria-label="שם החיבור"
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="h-9 flex-1 min-w-32 font-medium"
        />
        <Badge tone={status.tone} className="gap-1.5 py-1">
          <StatusDot status={account.status} />
          {status.label}
        </Badge>
      </div>

      {account.phone && (
        <p className="text-[0.8125rem] text-muted">
          מחובר למספר <span dir="ltr" className="text-ink tabular-nums">+{account.phone}</span>
        </p>
      )}

      {account.status === 'QR' && account.qrDataUrl && (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-control)] bg-surface-2 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={account.qrDataUrl}
            alt="קוד QR לחיבור וואטסאפ"
            width={200}
            height={200}
            className="rise-in size-[200px] rounded-lg bg-white p-1.5"
          />
          <Hint className="text-center">
            בוואטסאפ בטלפון: הגדרות ← מכשירים מקושרים ← קישור מכשיר
          </Hint>
        </div>
      )}

      <div className="flex gap-2">
        {account.status === 'READY' && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              const ok = await confirm({
                title: `להתנתק מהחיבור "${account.label}"?`,
                description: 'יהיה צורך לסרוק QR מחדש כדי לשלוח מהמספר הזה.',
                confirmLabel: 'התנתקות',
                tone: 'danger',
              });
              if (!ok) return;
              setBusy(true);
              await run(() => api(`/api/accounts/${account.id}/logout`, { method: 'POST' }));
              await refreshAccounts();
              setBusy(false);
            }}
          >
            <LinkOffIcon className="size-4" />
            התנתקות
          </Button>
        )}
        {canRemove && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            className="text-bad hover:not-disabled:bg-bad-soft"
            onClick={async () => {
              const ok = await confirm({
                title: `להסיר את החיבור "${account.label}"?`,
                description: 'מוזמנים שהצד שלהם מפנה לחיבור הזה לא יהיו ניתנים לשליחה.',
                confirmLabel: 'הסרה',
                tone: 'danger',
              });
              if (!ok) return;
              setBusy(true);
              await run(() => api(`/api/accounts/${account.id}`, { method: 'DELETE' }));
              await refreshAccounts();
              setBusy(false);
            }}
          >
            <TrashIcon className="size-4" />
            הסרה
          </Button>
        )}
      </div>
    </div>
  );
}

export function ConnectionsPanel() {
  const accounts = useApp((s) => s.accounts);
  const refreshAccounts = useApp((s) => s.refreshAccounts);
  const [newLabel, setNewLabel] = React.useState('');
  const [adding, setAdding] = React.useState(false);

  const addAccount = async () => {
    setAdding(true);
    const result = await run(() => apiJson('/api/accounts', 'POST', { label: newLabel }));
    if (result) {
      setNewLabel('');
      toast.success('החיבור נוסף — קוד ה-QR יופיע בעוד רגע');
    }
    await refreshAccounts();
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <Hint>
        אפשר לחבר כמה מספרי וואטסאפ (למשל שלך ושל בן/בת הזוג). כשמחוברים שני חיבורים ומעלה, עמודת
        ״צד״ של כל מוזמן חייבת להתאים לשם של אחד החיבורים כאן — וההזמנה תישלח מהמספר הזה.
      </Hint>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account, index) => (
          <AccountCard
            key={account.id}
            account={account}
            index={index}
            canRemove={accounts.length > 1}
          />
        ))}
      </div>

      <div className="card flex flex-wrap items-end gap-2 p-4">
        <div className="min-w-52 flex-1">
          <Input
            value={newLabel}
            placeholder="שם החיבור (למשל: אושרי)"
            aria-label="שם החיבור החדש"
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addAccount()}
          />
        </div>
        <Button variant="primary" onClick={addAccount} disabled={adding}>
          <PlusIcon className="size-4" />
          הוספת חיבור וואטסאפ
        </Button>
      </div>
    </div>
  );
}
