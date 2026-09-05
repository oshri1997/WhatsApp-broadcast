'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) });
    if (!response.ok) {
      setError((await response.json()).error || 'לא ניתן להתחבר');
      setLoading(false);
      return;
    }
    const { role } = await response.json();
    router.replace(role === 'admin' ? '/admin' : new URLSearchParams(window.location.search).get('next') || '/');
  }

  return <main className="mx-auto flex min-h-dvh w-full max-w-md items-center p-5"><form onSubmit={submit} className="card w-full space-y-5 p-7"><div><p className="dashboard-kicker">כניסה מאובטחת</p><h1 className="mt-1 text-2xl font-bold">הזמנות חתונה בוואטסאפ</h1></div><label className="block text-sm font-medium">שם משתמש<input required name="username" autoComplete="username" className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2" /></label><label className="block text-sm font-medium">סיסמה<input required name="password" type="password" autoComplete="current-password" className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2" /></label>{error && <p className="text-sm text-danger">{error}</p>}<button disabled={loading} className="w-full rounded-lg bg-brand px-4 py-2.5 font-bold text-on-brand disabled:opacity-60">{loading ? 'מתחבר…' : 'כניסה למערכת'}</button></form></main>;
}
