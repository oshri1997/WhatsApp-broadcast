'use client';

import * as React from 'react';
import { Select } from '@base-ui/react/select';
import { toast } from 'sonner';
import type { InvitationMediaView, ResolvedGuest } from '@/lib/types';
import { api, apiJson, hasMultipleAccounts, run, useApp } from '@/lib/store';
import { MESSAGE_TEMPLATES, RSVP_QUESTION_MESSAGE } from '@/lib/templates';
import { Button } from '@/components/ui/button';
import { Hint, Label, Textarea } from '@/components/ui/field';
import { useConfirm } from '@/components/ui/confirm';
import { CheckIcon, ChevronIcon, ImageIcon, SendIcon, TrashIcon } from '@/components/icons';

function TemplatePicker() {
  const message = useApp((s) => s.message);
  const setMessage = useApp((s) => s.setMessage);
  const confirm = useConfirm();

  return (
    <Select.Root
      items={MESSAGE_TEMPLATES.map((t) => ({ label: t.label, value: t.label }))}
      value={null}
      onValueChange={async (value) => {
        const template = MESSAGE_TEMPLATES.find((t) => t.label === value);
        if (!template) return;
        if (message.trim() && message.trim() !== template.text.trim()) {
          const ok = await confirm({
            title: 'להחליף את ההודעה הנוכחית?',
            description: 'תוכן התבנית ידרוס את מה שכתוב עכשיו בתיבת ההודעה.',
            confirmLabel: 'טעינת התבנית',
          });
          if (!ok) return;
        }
        setMessage(template.text);
      }}
    >
      <Select.Trigger className="control flex h-10 items-center justify-between gap-2 text-start">
        <Select.Value placeholder="בחירת תבנית מוכנה…" />
        <Select.Icon>
          <ChevronIcon className="size-4 text-muted" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={6} className="z-40 outline-none">
          {/*
            A popover is anchored to its trigger, so it scales from there —
            never from its own centre.
          */}
          <Select.Popup className="card min-w-[var(--anchor-width)] origin-[var(--transform-origin)] p-1 transition-[opacity,scale] duration-150 ease-snap data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0">
            <Select.List>
              {MESSAGE_TEMPLATES.map((template) => (
                <Select.Item
                  key={template.label}
                  value={template.label}
                  className="flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-highlighted:bg-brand-soft data-highlighted:text-brand-ink"
                >
                  <Select.ItemIndicator>
                    <CheckIcon className="size-4" />
                  </Select.ItemIndicator>
                  <Select.ItemText>{template.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

function MediaUpload() {
  const media = useApp((s) => s.media);
  const setMedia = useApp((s) => s.setMedia);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('media', file);
    const result = await run(() =>
      api<InvitationMediaView>('/api/invitation-media', { method: 'POST', body: formData })
    );
    setUploading(false);
    if (!result) return;
    setMedia(result);
    toast.success('הקובץ צורף להזמנה');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          aria-label="תמונה או סרטון להזמנה"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
          className="max-w-64 text-[0.8125rem] text-muted file:me-2 file:cursor-pointer file:rounded-[var(--radius-control)] file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-[0.8125rem] file:font-medium file:text-ink"
        />
        {uploading && <span className="text-[0.8125rem] text-muted">מעלה…</span>}
      </div>

      {media.url && (
        <div className="rise-in flex flex-wrap items-start gap-3 rounded-[var(--radius-control)] bg-surface-2 p-3">
          {media.kind === 'video' ? (
            <video src={media.url} controls className="max-h-56 rounded-lg" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.url} alt="תצוגה מקדימה של ההזמנה" className="max-h-56 rounded-lg" />
          )}
          <div className="flex flex-col gap-2">
            <span className="text-[0.8125rem] text-muted">{media.filename}</span>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted hover:not-disabled:text-bad"
              onClick={async () => {
                await run(() => api('/api/invitation-media', { method: 'DELETE' }));
                setMedia({ url: null, kind: null, filename: null });
                if (inputRef.current) inputRef.current.value = '';
              }}
            >
              <TrashIcon className="size-4" />
              הסרת הקובץ
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ComposePanel() {
  const message = useApp((s) => s.message);
  const setMessage = useApp((s) => s.setMessage);
  const guests = useApp((s) => s.guests);
  const accounts = useApp((s) => s.accounts);
  const selected = useApp((s) => s.selected);
  const attachment = useApp((s) => s.media);
  const setJob = useApp((s) => s.setJob);
  const confirm = useConfirm();
  const [sending, setSending] = React.useState(false);

  const anyReady = accounts.some((a) => a.status === 'READY');
  const selectedGuests = guests.filter((g) => selected.has(g.id));
  const previewGuest: ResolvedGuest | undefined = selectedGuests[0] ?? guests[0];
  const preview = previewGuest
    ? message.replaceAll('{{שם}}', previewGuest.name).replaceAll('{{name}}', previewGuest.name)
    : message;

  const personalCount = selectedGuests.filter((g) => g.customMessage?.trim()).length;

  const send = async () => {
    if (!anyReady) {
      toast.error('יש לחבר לפחות חשבון וואטסאפ אחד לפני השליחה');
      return;
    }
    if (selected.size === 0) {
      toast.error('יש לבחור לפחות מוזמן אחד ברשימת המוזמנים');
      return;
    }

    const ok = await confirm({
      title: `לשלוח את ההזמנה ל-${selected.size} מוזמנים?`,
      description:
        'ההודעות נשלחות אחת אחרי השנייה עם השהיה אקראית ביניהן. אי אפשר לבטל הודעה שכבר יצאה.',
      confirmLabel: 'שליחה',
    });
    if (!ok) return;

    setSending(true);
    const result = await run(() =>
      apiJson<{ jobId: string }>('/api/send', 'POST', {
        guestIds: [...selected],
        message,
      })
    );
    setSending(false);
    if (!result) return;
    setJob({ id: result.jobId, total: selected.size, sent: 0, failed: [], current: null, status: 'running' });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label>תבנית מוכנה</Label>
          <TemplatePicker />
        </div>

        <div>
          <Label htmlFor="message">ההודעה</Label>
          <Textarea
            id="message"
            rows={9}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Hint className="mt-1.5">
            <code className="rounded bg-surface-2 px-1 py-0.5">{'{{שם}}'}</code> יוחלף בשם המוזמן.
            מוזמן עם הודעה אישית יקבל אותה במקום הטקסט הזה
            {personalCount > 0 && ` (${personalCount} מהנבחרים)`}.
          </Hint>
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ImageIcon className="size-4 text-brand" />
            תמונה או סרטון להזמנה (אופציונלי)
          </h3>
          <Hint className="mb-3">
            הקובץ יישלח לכולם עם ההודעה כתיאור מתחתיו. סרטונים גדולים עלולים להיכשל בשליחה — עדיף
            לשמור על גודל סביר.
          </Hint>
          <MediaUpload />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={send} disabled={sending || selected.size === 0}>
            <SendIcon className="size-4" />
            שליחת הזמנות
            {selected.size > 0 && <span className="tabular-nums opacity-80">({selected.size})</span>}
          </Button>
          {!anyReady && (
            <span className="text-[0.8125rem] text-warn">אין חיבור וואטסאפ מוכן לשליחה</span>
          )}
        </div>
      </div>

      {/* Live preview of the two separate messages a guest actually receives. */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Label>תצוגה מקדימה</Label>
        <div className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-[oklch(0.93_0.02_150)] p-4 dark:bg-[oklch(0.28_0.02_150)]">
          <div className="ms-auto w-fit max-w-full rounded-2xl rounded-tl-md bg-[oklch(0.95_0.05_145)] px-3 py-2 text-[0.9rem] leading-relaxed whitespace-pre-wrap shadow-sm dark:bg-[oklch(0.38_0.05_150)]">
            {attachment.url && attachment.kind === 'image' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={attachment.url} alt="" className="mb-2 max-h-40 rounded-lg" />
            )}
            {attachment.url && attachment.kind === 'video' && (
              <span className="mb-2 block rounded-lg bg-black/10 px-2 py-1 text-[0.75rem]">
                🎬 {attachment.filename}
              </span>
            )}
            {preview}
          </div>
          <div className="ms-auto w-fit max-w-full rounded-2xl rounded-tl-md bg-[oklch(0.95_0.05_145)] px-3 py-2 text-[0.9rem] leading-relaxed whitespace-pre-wrap shadow-sm dark:bg-[oklch(0.38_0.05_150)]">
            {RSVP_QUESTION_MESSAGE}
          </div>
        </div>
        <Hint className="mt-2">
          {previewGuest
            ? `לדוגמה עבור ${previewGuest.name} - שתי הודעות נפרדות, ההזמנה ואז שאלת אישור ההגעה`
            : 'הוסיפו מוזמנים כדי לראות איך זה נראה עם שם אמיתי'}
        </Hint>
      </div>
    </div>
  );
}
