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

    // RSVP replies arrive over WhatsApp, not through this UI, so the list has
    // to poll to stay honest. Connection status changes faster (QR codes
    // expire), hence the tighter interval.
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

export function AppShell() {
  const [tab, setTab] = React.useState<TabValue>('guests');
  const loaded = useApp((s) => s.loaded);
  const activeTab = TABS.find((item) => item.value === tab) ?? TABS[0];
  useLiveData();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-6 px-4 pb-32 pt-5 sm:px-6">
      <header className="app-nav sticky top-0 z-20 -mx-4 sm:-mx-6">
        <div className="nav-brand">
          <span aria-hidden className="nav-brand__mark">
            💌
          </span>
          <h1 className="nav-brand__title">הזמנות חתונה בוואטסאפ</h1>
        </div>
        <div className="nav-actions">
          <ConnectionPill />
          <ThemeToggle />
          <button
            type="button"
            className="text-xs font-semibold text-muted hover:text-foreground"
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.assign('/login'); }}
          >
            התנתקות
          </button>
        </div>
      </header>

      <section className="dashboard-intro card overflow-hidden" aria-labelledby="dashboard-title">
        <div className="dashboard-intro__copy">
          <p className="dashboard-kicker">מרכז השליטה</p>
          <h2 id="dashboard-title">שולחים הזמנה, בפשטות</h2>
          <p>מעלים רשימה, בוחרים את הנמענים ושולחים את ההזמנה בוואטסאפ.</p>
        </div>
        <div className="dashboard-intro__status">
          <span className="dashboard-status-dot" aria-hidden />
          <span>המערכת מתעדכנת אוטומטית</span>
        </div>
      </section>

      <StatTiles />

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

        <div className="flex items-baseline gap-3 border-b border-line pb-3">
          <span className="text-[0.75rem] font-bold tracking-[0.1em] text-brand-ink">{activeTab.step}</span>
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

      {!loaded && <p className="text-center text-sm text-muted">טוען…</p>}

      <SendProgress />
    </div>
  );
}
