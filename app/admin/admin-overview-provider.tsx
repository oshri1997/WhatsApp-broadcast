'use client';

import * as React from 'react';

export type AdminUser = { username: string; email: string; createdAt: string; hasWorkspace: boolean; guests: number; sends: number; lastActivityAt: string | null };
export type AdminOverview = { betaCapacity: number; metrics: { registeredUsers: number; availableSeats: number; activeWorkspaces: number; totalGuests: number; totalSendJobs: number }; users: AdminUser[] };

type OverviewState = {
  overview: AdminOverview;
  setOverview: React.Dispatch<React.SetStateAction<AdminOverview>>;
  loading: boolean;
  refresh: () => Promise<void>;
};

const OverviewContext = React.createContext<OverviewState | null>(null);

export function AdminOverviewProvider({ initialOverview, children }: { initialOverview: AdminOverview; children: React.ReactNode }) {
  const [overview, setOverview] = React.useState(initialOverview);
  const [loading, setLoading] = React.useState(false);
  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/overview', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'לא ניתן לטעון נתוני ניהול');
      setOverview(data);
    } finally {
      setLoading(false);
    }
  }, []);

  return <OverviewContext.Provider value={{ overview, setOverview, loading, refresh }}>{children}</OverviewContext.Provider>;
}

export function useAdminOverview() {
  const value = React.useContext(OverviewContext);
  if (!value) throw new Error('useAdminOverview must be used inside AdminOverviewProvider');
  return value;
}
