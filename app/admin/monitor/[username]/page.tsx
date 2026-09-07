import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUserMonitor } from '@/lib/server/adminOverview';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'אין פעילות עדיין';
}

export default async function CoupleMonitorPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const monitor = getUserMonitor(username);
  if (!monitor) notFound();

  const cards = [
    ['מוזמנים', monitor.guests, 'ברשימה'],
    ['שליחות', monitor.sends, `${monitor.completedJobs} הסתיימו`],
    ['הודעות שנשלחו', monitor.sentMessages, `${monitor.failedMessages} כשלו`],
    ['חיבורי WhatsApp', monitor.connections, monitor.connections ? 'מוגדרים בחשבון' : 'טרם הוגדרו'],
  ];

  return <main className="min-h-dvh bg-[#101827] px-4 py-5 text-slate-100 sm:px-6 lg:px-8" dir="rtl"><div className="mx-auto max-w-6xl">
    <header className="mb-7 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold tracking-[.16em] text-sky-300">COUPLE MONITOR · READ ONLY</p><h1 className="mt-2 text-3xl font-bold">מעקב זוג: <span dir="ltr">{monitor.user.username}</span></h1><p dir="ltr" className="mt-2 text-sm text-slate-400">{monitor.user.email}</p></div><Link href="/admin" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-bold transition hover:bg-white/10">חזרה לניהול הבטא</Link></header>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="מדדי המעקב">{cards.map(([label, value, detail]) => <article key={label} className="rounded-2xl border border-white/10 bg-white/[.045] p-5"><p className="text-3xl font-bold tabular-nums text-sky-100">{value}</p><p className="mt-2 text-sm font-bold">{label}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></article>)}</section>
    <section className="mt-6 grid gap-5 lg:grid-cols-2"><article className="rounded-2xl border border-white/10 bg-slate-900/60 p-6"><p className="text-xs font-bold tracking-[.16em] text-sky-300">WORKSPACE STATUS</p><h2 className="mt-1 text-xl font-bold">מצב סביבת העבודה</h2><dl className="mt-5 space-y-4 text-sm"><div className="flex items-center justify-between gap-4"><dt className="text-slate-400">סביבת עבודה</dt><dd className={monitor.hasWorkspace ? 'font-bold text-emerald-300' : 'font-bold text-slate-500'}>{monitor.hasWorkspace ? 'מוכנה ומבודדת' : 'טרם הופעלה'}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-slate-400">פעילות אחרונה</dt><dd className="font-bold">{formatDate(monitor.lastActivityAt)}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-slate-400">קובץ להזמנה</dt><dd className="font-bold">{monitor.hasInvitationMedia ? 'מצורף' : 'ללא קובץ'}</dd></div></dl></article>
      <article className="rounded-2xl border border-sky-300/15 bg-gradient-to-b from-sky-400/[.09] to-white/[.035] p-6"><p className="text-xs font-bold tracking-[.16em] text-sky-300">SEND HEALTH</p><h2 className="mt-1 text-xl font-bold">בריאות שליחות</h2><dl className="mt-5 space-y-4 text-sm"><div className="flex items-center justify-between gap-4"><dt className="text-slate-400">שליחות בתהליך</dt><dd className="font-bold text-sky-200">{monitor.runningJobs}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-slate-400">שליחות שנקטעו</dt><dd className="font-bold text-amber-200">{monitor.interruptedJobs}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-slate-400">הודעות שנכשלו</dt><dd className="font-bold text-rose-200">{monitor.failedMessages}</dd></div></dl><p className="mt-6 rounded-xl border border-white/10 bg-slate-950/30 p-3 text-xs leading-5 text-slate-400">העמוד מציג נתוני תפעול בלבד. תוכן הודעות, מספרי טלפון, QR ופרטי התחברות אינם נגישים כאן.</p></article></section>
  </div></main>;
}
