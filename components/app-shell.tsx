'use client';

import * as React from 'react';
import { Tabs } from '@base-ui/react/tabs';
import { useApp } from '@/lib/store';
import { StatTiles } from '@/components/stat-tiles';
import { ConnectionsPanel } from '@/components/connections-panel';
import { GuestsPanel } from '@/components/guests-panel';
import { ComposePanel } from '@/components/compose-panel';
import { SendProgress } from '@/components/send-progress';
import { ThemeToggle } from '@/components/theme-toggle';
import { BetaNotice } from '@/components/beta-notice';

type TabValue = 'guests' | 'connections' | 'compose';

const TABS: { value: TabValue; label: string; step: string; description: string }[] = [
  { value: 'guests', label: 'מוזמנים', step: '01', description: 'ייבוא, עריכה ובחירת נמענים' },
  { value: 'compose', label: 'שליחת הזמנה', step: '02', description: 'ניסוח ושליחת ברודקאסט' },
  { value: 'connections', label: 'חיבורי וואטסאפ', step: 'הגדרות', description: 'חיבור המספרים שמהם שולחים' },
];

function useLiveData() {
  const refreshGuests = useApp((s) => s.refreshGuests);
  const refreshAccounts = useApp((s) => s.refreshAccounts);
  const refreshMedia = useApp((s) => s.refreshMedia);

  React.useEffect(() => {
    // Accounts first: guest -> account resolution depends on how many are
    // connected, so loading guests before them would flash bogus warnings.
    refreshAccounts().then(() => refreshGuests({ resetSelection: true }));
    refreshMedia();

    // Keep the guest list and QR connection status current while the app is open.
    const guestsTimer = setInterval(() => refreshGuests(), 4000);
    const accountsTimer = setInterval(() => refreshAccounts(), 2500);

    return () => {
      clearInterval(guestsTimer);
      clearInterval(accountsTimer);
    };
  }, [refreshGuests, refreshAccounts, refreshMedia]);
}

function ConnectionPill() {
  const accounts = useApp((s) => s.accounts);
  const ready = accounts.filter((a) => a.status === 'READY').length;
  const allReady = accounts.length > 0 && ready === accounts.length;

  return (
    <span className="nav-connection">
      <span
        className={`nav-connection__dot ${allReady ? 'bg-good' : ready > 0 ? 'bg-warn' : 'bg-muted'}`}
      />
      <span className="nav-connection__label">WhatsApp</span>
      <span className="tabular-nums text-muted">{ready}/{accounts.length || 1}</span>
    </span>
  );
}

function DashboardHero() {
  const guests = useApp((s) => s.guests);
  const accounts = useApp((s) => s.accounts);
  const selected = useApp((s) => s.selected.size);
  const ready = accounts.filter((account) => account.status === 'READY').length;
  const canSend = selected > 0 && ready > 0;
  const journey = [
    { label: 'מוזמנים', detail: guests.length ? `${guests.length} ברשימה` : 'הוסיפו רשימה', complete: guests.length > 0 },
    { label: 'חיבור', detail: ready ? `${ready} פעילים` : 'חברו WhatsApp', complete: ready > 0 },
    { label: 'שליחה', detail: selected ? `${selected} נבחרו` : 'בחרו נמענים', complete: canSend },
  ];

  return (
    <section className="dashboard-hero" aria-labelledby="dashboard-title">
      <div className="dashboard-hero__copy">
        <p className="dashboard-hero__eyebrow"><span /> שולחים הזמנות, ברגע הנכון</p>
        <h2 id="dashboard-title">ההזמנה שלכם<br /><em>כבר בדרך.</em></h2>
        <p className="dashboard-hero__description">
          מרכז אחד לרשימת המוזמנים, הודעה אישית ושליחה מסודרת — בלי לעבור בין גיליונות וצ׳אטים.
        </p>
        <div className="dashboard-hero__actions">
          <span className="hero-connection"><i className={ready ? 'is-ready' : ''} /> {ready ? `${ready} חיבורים מוכנים` : 'נדרש חיבור WhatsApp'}</span>
        </div>
        <div className="hero-metrics" aria-label="סטטוס מהיר">
          <span><strong>{guests.length}</strong> מוזמנים</span>
          <span><strong>{selected}</strong> נבחרו</span>
          <span><strong>{ready}</strong> חיבורים</span>
        </div>
        <ol className="hero-journey" aria-label="מסלול שליחת ההזמנה">
          {journey.map((step, index) => (
            <li key={step.label} className={step.complete ? 'is-complete' : ''}>
              <span className="hero-journey__number">0{index + 1}</span>
              <span><strong>{step.label}</strong><small>{step.detail}</small></span>
            </li>
          ))}
        </ol>
      </div>
      <div className="dashboard-hero__visual" aria-hidden="true">
        <div className="hero-glow" />
        <div className="hero-orbit hero-orbit--outer" />
        <div className="hero-orbit hero-orbit--inner" />
        <div className="hero-chat hero-chat--one"><span>מזל טוב! נשמח לחגוג איתכם</span><time>19:48</time></div>
        <div className="hero-chat hero-chat--two"><span>בעזרת השם, נתראה בשמחה</span><time>19:51 ✓✓</time></div>
        <div className="hero-seal"><span className="hero-seal__envelope" /><small>2026</small></div>
        <div className="hero-spark hero-spark--one" /><div className="hero-spark hero-spark--two" />
      </div>
    </section>
  );
}

function WelcomeDialog({ username }: { username: string }) {
  const [open, setOpen] = React.useState(false);
  const storageKey = `wedding-broadcast-welcome:${username}`;

  React.useEffect(() => {
    if (!window.localStorage.getItem(storageKey)) setOpen(true);
  }, [storageKey]);

  React.useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const close = () => {
    window.localStorage.setItem(storageKey, 'seen');
    setOpen(false);
  };

  if (!open) return null;
  return (
    <div className="welcome-dialog__backdrop" role="presentation" onMouseDown={close}>
      <section className="welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title" onMouseDown={(event) => event.stopPropagation()}>
        <span className="welcome-dialog__mark" aria-hidden><span /></span>
        <p className="welcome-dialog__eyebrow">התחלה נעימה</p>
        <h2 id="welcome-title">מזל טוב לרגל הנישואין, {username}!</h2>
        <p>כאן אפשר לנהל את שליחת ההזמנות בוואטסאפ, בצורה אישית ומסודרת.</p>
        <ol className="welcome-dialog__steps">
          <li><strong>מחברים WhatsApp</strong><span>סורקים QR מהטלפון.</span></li>
          <li><strong>מוסיפים מוזמנים</strong><span>מעלים קובץ או מוסיפים ידנית.</span></li>
          <li><strong>כותבים ושולחים</strong><span>בוחרים נמענים ושולחים ברודקאסט.</span></li>
        </ol>
        <p className="welcome-dialog__hint">ליד פעולות מרכזיות תמצאו סימן שאלה קטן עם הסבר קצר.</p>
        <button type="button" className="welcome-dialog__close" onClick={close}>בואו נתחיל</button>
      </section>
    </div>
  );
}

export function AppShell({ username }: { username: string }) {
  const [tab, setTab] = React.useState<TabValue>('guests');
  const [scrolled, setScrolled] = React.useState(false);
  const loaded = useApp((s) => s.loaded);
  const activeTab = TABS.find((item) => item.value === tab) ?? TABS[0];
  useLiveData();

  React.useEffect(() => {
    const updateScrollState = () => setScrolled(window.scrollY > 12);
    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);

  return (
    <div className="home-shell mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-6 px-4 pb-32 pt-5 sm:px-6">
      <a className="skip-link" href="#workspace">דילוג לאזור העבודה</a>
      <header className={`app-nav sticky top-0 z-20 ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="nav-brand">
          <span aria-hidden className="nav-brand__mark"><span /></span>
          <div className="min-w-0">
            <p className="nav-brand__eyebrow">מרכז השליטה</p>
            <h1 className="nav-brand__title">הזמנות חתונה בוואטסאפ</h1>
          </div>
        </div>
        <nav className="nav-actions" aria-label="פעולות חשבון">
          <span className="nav-greeting" title={`שלום, ${username}`}><span>שלום,</span> <strong>{username}</strong></span>
          <span className="nav-actions__divider" aria-hidden="true" />
          <ConnectionPill />
          <span className="nav-actions__divider" aria-hidden="true" />
          <ThemeToggle />
          <a href="/api/workspace/backup" className="text-xs font-semibold text-muted hover:text-foreground">גיבוי</a>
          <a href="/account/password" className="text-xs font-semibold text-muted hover:text-foreground">סיסמה</a>
          <button
            type="button"
            className="text-xs font-semibold text-muted hover:text-foreground"
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.assign('/login'); }}
          >
            התנתקות
          </button>
        </nav>
      </header>

      <BetaNotice username={username} />
      <DashboardHero />

      <StatTiles />

      <main id="workspace">
        <Tabs.Root
          value={tab}
          onValueChange={(value) => setTab(value as TabValue)}
          className="flex flex-col gap-5"
        >
        <Tabs.List aria-label="ניווט ראשי" className="workflow-nav">
          {TABS.map((item) => (
            <Tabs.Tab
              key={item.value}
              value={item.value}
              className="workflow-nav__item relative z-1 select-none data-active:text-on-brand data-active:hover:text-on-brand"
            >
              <span className="workflow-nav__step">{item.step}</span>
              <span>{item.label}</span>
            </Tabs.Tab>
          ))}
          {/*
            The pill slides between tabs instead of cutting, so the eye can
            follow where the selection went. ease-flow for on-screen movement.
          */}
          <Tabs.Indicator className="absolute top-1 left-0 z-0 h-[calc(100%-0.5rem)] w-(--active-tab-width) translate-x-(--active-tab-left) rounded-[11px] bg-brand transition-[translate,width] duration-250 ease-flow" />
        </Tabs.List>

        <div className="workflow-heading flex items-baseline gap-3 border-b border-line pb-3">
          <span className="workflow-heading__number">{activeTab.step}</span>
          <div>
            <h2 className="text-base font-bold">{activeTab.label}</h2>
            <p className="text-[0.8125rem] text-muted">{activeTab.description}</p>
          </div>
        </div>

        <Tabs.Panel value="guests" className="outline-none">
          <GuestsPanel onGoToCompose={() => setTab('compose')} />
        </Tabs.Panel>
        <Tabs.Panel value="compose" className="outline-none">
          <ComposePanel />
        </Tabs.Panel>
        <Tabs.Panel value="connections" className="outline-none">
          <ConnectionsPanel />
        </Tabs.Panel>
        </Tabs.Root>
      </main>

      {!loaded && <p className="text-center text-sm text-muted">טוען…</p>}

      <SendProgress />
      <WelcomeDialog username={username} />
    </div>
  );
}
