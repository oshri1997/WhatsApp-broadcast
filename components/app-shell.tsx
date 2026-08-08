'use client';

import * as React from 'react';
import { Tabs } from '@base-ui/react/tabs';
import { useApp } from '@/lib/store';
import { StatTiles } from '@/components/stat-tiles';
import { ConnectionsPanel } from '@/components/connections-panel';
import { GuestsPanel } from '@/components/guests-panel';
import { ComposePanel } from '@/components/compose-panel';
import { SeatingPanel } from '@/components/seating-panel';
import { SendProgress } from '@/components/send-progress';
import { ThemeToggle } from '@/components/theme-toggle';

type TabValue = 'guests' | 'connections' | 'compose' | 'seating';

const TABS: { value: TabValue; label: string }[] = [
  { value: 'guests', label: 'מוזמנים' },
  { value: 'compose', label: 'הודעה ושליחה' },
  { value: 'seating', label: 'סידור הושבה' },
  { value: 'connections', label: 'חיבורי וואטסאפ' },
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
    <span className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[0.8125rem] font-medium">
      <span
        className={`size-2 rounded-full ${allReady ? 'bg-good' : ready > 0 ? 'bg-warn' : 'bg-muted'}`}
      />
      <span className="tabular-nums">
        {ready}/{accounts.length || 1}
      </span>
      <span className="text-muted">מחוברים</span>
    </span>
  );
}

export function AppShell() {
  const [tab, setTab] = React.useState<TabValue>('guests');
  const loaded = useApp((s) => s.loaded);
  useLiveData();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-6 px-4 pb-32 pt-5 sm:px-6">
      <header className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-line/70 bg-bg/75 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <h1 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
          <span aria-hidden className="grid size-8 place-items-center rounded-xl bg-linear-to-br from-brand to-[oklch(0.6_0.17_350)] text-base shadow-sm">
            💌
          </span>
          הזמנות חתונה בוואטסאפ
        </h1>
        <div className="ms-auto flex items-center gap-2">
          <ConnectionPill />
          <ThemeToggle />
        </div>
      </header>

      <StatTiles />

      <Tabs.Root
        value={tab}
        onValueChange={(value) => setTab(value as TabValue)}
        className="flex flex-col gap-5"
      >
        <Tabs.List className="relative flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface/80 p-1 backdrop-blur-md">
          {TABS.map((item) => (
            <Tabs.Tab
              key={item.value}
              value={item.value}
              className="relative z-1 rounded-full px-4 py-1.5 text-[0.875rem] font-medium text-muted transition-colors duration-150 select-none hover:text-ink data-active:text-on-brand data-active:hover:text-on-brand"
            >
              {item.label}
            </Tabs.Tab>
          ))}
          {/*
            The pill slides between tabs instead of cutting, so the eye can
            follow where the selection went. ease-flow for on-screen movement.
          */}
          <Tabs.Indicator className="absolute top-1 left-0 z-0 h-[calc(100%-0.5rem)] w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-brand transition-[translate,width] duration-250 ease-flow" />
        </Tabs.List>

        <Tabs.Panel value="guests" className="outline-none">
          <GuestsPanel onGoToCompose={() => setTab('compose')} />
        </Tabs.Panel>
        <Tabs.Panel value="compose" className="outline-none">
          <ComposePanel />
        </Tabs.Panel>
        <Tabs.Panel value="seating" className="outline-none">
          <SeatingPanel />
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
