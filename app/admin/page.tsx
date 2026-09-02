'use client';

import * as React from 'react';

interface User { username: string; email: string; createdAt: string }
interface CreatedUser { username: string; email: string; password: string }

export default function AdminPage() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [created, setCreated] = React.useState<CreatedUser | null>(null);
  const [error, setError] = React.useState('');
  React.useEffect(() => { fetch('/api/admin/users').then((response) => response.json()).then((data) => setUsers(data.users || [])); }, []);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setCreated(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/admin/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: form.get('email') }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || 'לא ניתן ליצור משתמש'); return; }
    setCreated(data.user); setUsers((current) => [{ username: data.user.username, email: data.user.email, createdAt: new Date().toISOString() }, ...current]); event.currentTarget.reset();
  }
  return <main className="mx-auto min-h-dvh w-full max-w-3xl p-5 sm:p-8"><div className="mb-7 flex items-center justify-between"><div><p className="dashboard-kicker">ניהול גישה</p><h1 className="text-2xl font-bold">משתמשים</h1></div><div className="flex gap-4 text-sm font-semibold text-brand-ink"><a href="/account/password">שינוי סיסמה</a><a href="/">חזרה למערכת</a></div></div><section className="card mb-6 p-5"><h2 className="text-lg font-bold">יצירת משתמש חדש</h2><p className="mt-1 text-sm text-muted">הזן אימייל; שם משתמש וסיסמה התחלתית ייווצרו אוטומטית.</p><form onSubmit={create} className="mt-4 flex flex-col gap-3 sm:flex-row"><input required type="email" name="email" placeholder="name@example.com" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2" /><button className="rounded-lg bg-brand px-4 py-2 font-bold text-on-brand">יצירת פרטים</button></form>{error && <p className="mt-3 text-sm text-danger">{error}</p>}{created && <div className="mt-4 rounded-xl border border-brand/30 bg-brand/10 p-4"><p className="font-bold">המשתמש נוצר — העתק את הפרטים עכשיו</p><dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"><dt>אימייל</dt><dd dir="ltr">{created.email}</dd><dt>שם משתמש</dt><dd dir="ltr" className="font-mono font-bold">{created.username}</dd><dt>סיסמה זמנית</dt><dd dir="ltr" className="font-mono font-bold">{created.password}</dd></dl></div>}</section><section className="card overflow-hidden"><div className="border-b border-line px-5 py-4"><h2 className="font-bold">משתמשים קיימים</h2></div><ul className="divide-y divide-line">{users.length ? users.map((user) => <li key={user.username} className="flex items-center justify-between gap-4 px-5 py-3"><div><p dir="ltr" className="font-mono text-sm">{user.username}</p><p dir="ltr" className="text-sm text-muted">{user.email}</p></div><time className="text-xs text-muted">{new Date(user.createdAt).toLocaleDateString('he-IL')}</time></li>) : <li className="px-5 py-8 text-center text-sm text-muted">עדיין לא נוצרו משתמשים.</li>}</ul></section></main>;
}
