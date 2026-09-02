'use client';

import * as React from 'react';

export default function PasswordPage() {
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    const form = new FormData(event.currentTarget);
    const nextPassword = String(form.get('nextPassword') || '');
    if (nextPassword !== form.get('confirmation')) { setError('הסיסמאות החדשות אינן תואמות'); return; }
    const response = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ currentPassword: form.get('currentPassword'), nextPassword }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || 'לא ניתן לעדכן סיסמה'); return; }
    event.currentTarget.reset(); setMessage('הסיסמה עודכנה בהצלחה.');
  }
  return <main className="mx-auto min-h-dvh w-full max-w-md p-5 sm:pt-16"><a href="/" className="text-sm font-semibold text-brand-ink">חזרה למערכת</a><form onSubmit={submit} className="card mt-5 space-y-5 p-7"><div><p className="dashboard-kicker">אבטחת חשבון</p><h1 className="mt-1 text-2xl font-bold">שינוי סיסמה</h1><p className="mt-1 text-sm text-muted">הסיסמה החדשה חייבת להכיל לפחות 12 תווים.</p></div><label className="block text-sm font-medium">סיסמה נוכחית<input required name="currentPassword" type="password" autoComplete="current-password" className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2" /></label><label className="block text-sm font-medium">סיסמה חדשה<input required minLength={12} name="nextPassword" type="password" autoComplete="new-password" className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2" /></label><label className="block text-sm font-medium">אימות סיסמה חדשה<input required minLength={12} name="confirmation" type="password" autoComplete="new-password" className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2" /></label>{error && <p className="text-sm text-danger">{error}</p>}{message && <p className="text-sm text-brand-ink">{message}</p>}<button className="w-full rounded-lg bg-brand px-4 py-2.5 font-bold text-on-brand">עדכון סיסמה</button></form></main>;
}
