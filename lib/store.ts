'use client';

import { create } from 'zustand';
import { toast } from 'sonner';
import type {
  AccountView,
  InvitationMediaView,
  ResolvedGuest,
  SendJob,
} from './types';
import { api, apiJson } from './api';
import { isSendable, matchesSearch } from './guests';
import { MESSAGE_TEMPLATES } from './templates';

interface AppState {
  guests: ResolvedGuest[];
  accounts: AccountView[];
  media: InvitationMediaView;
  selected: Set<number>;
  search: string;
  message: string;
  /** While a row is open for editing, polling must not stomp on the inputs. */
  editingGuestId: number | null;
  job: SendJob | null;
  loaded: boolean;

  refreshGuests: (options?: { resetSelection?: boolean }) => Promise<void>;
  refreshAccounts: () => Promise<void>;
  refreshMedia: () => Promise<void>;

  setSearch: (search: string) => void;
  setMessage: (message: string) => void;
  setEditingGuestId: (id: number | null) => void;
  setMedia: (media: InvitationMediaView) => void;
  setJob: (job: SendJob | null) => void;

  toggleGuest: (id: number, selected: boolean) => void;
  selectVisible: () => void;
  clearSelection: () => void;

  replaceGuest: (guest: ResolvedGuest) => void;
  addGuest: (guest: ResolvedGuest) => void;
  setGuests: (guests: ResolvedGuest[]) => void;
}

/** Accounts are only ambiguous — and "side" only matters — past one account. */
export function hasMultipleAccounts(accounts: AccountView[]) {
  return accounts.length > 1;
}

export const useApp = create<AppState>((set, get) => ({
  guests: [],
  accounts: [],
  media: { url: null, kind: null, filename: null },
  selected: new Set<number>(),
  search: '',
  message: MESSAGE_TEMPLATES[0].text,
  editingGuestId: null,
  job: null,
  loaded: false,

  refreshGuests: async ({ resetSelection = false } = {}) => {
    if (get().editingGuestId !== null) return;
    try {
      const { guests } = await api<{ guests: ResolvedGuest[] }>('/api/guests');
      const multiple = hasMultipleAccounts(get().accounts);

      set((state) => {
        if (resetSelection) {
          return {
            guests,
            loaded: true,
            selected: new Set(guests.filter((g) => isSendable(g, multiple)).map((g) => g.id)),
          };
        }
        // Keep the organizer's checkboxes, but drop ids that no longer exist or
        // stopped being sendable (a phone edit, a side that no longer resolves).
        const stillSendable = new Set(
          guests.filter((g) => isSendable(g, multiple)).map((g) => g.id)
        );
        const selected = new Set([...state.selected].filter((id) => stillSendable.has(id)));
        return { guests, loaded: true, selected };
      });
    } catch {
      /* Polling failures are transient; the next tick recovers. */
    }
  },

  refreshAccounts: async () => {
    try {
      const { accounts } = await api<{ accounts: AccountView[] }>('/api/accounts');
      set({ accounts });
    } catch {
      /* see refreshGuests */
    }
  },

  refreshMedia: async () => {
    try {
      set({ media: await api<InvitationMediaView>('/api/invitation-media') });
    } catch {
      /* see refreshGuests */
    }
  },

  setSearch: (search) => set({ search }),
  setMessage: (message) => set({ message }),
  setEditingGuestId: (editingGuestId) => set({ editingGuestId }),
  setMedia: (media) => set({ media }),
  setJob: (job) => set({ job }),

  toggleGuest: (id, selected) =>
    set((state) => {
      const next = new Set(state.selected);
      if (selected) next.add(id);
      else next.delete(id);
      return { selected: next };
    }),

  // Select everyone currently matching the search, not the whole list.
  selectVisible: () =>
    set((state) => {
      const multiple = hasMultipleAccounts(state.accounts);
      const next = new Set(state.selected);
      for (const guest of state.guests) {
        if (
          isSendable(guest, multiple) &&
          matchesSearch(guest, state.search)
        ) {
          next.add(guest.id);
        }
      }
      return { selected: next };
    }),

  clearSelection: () => set({ selected: new Set<number>() }),

  replaceGuest: (guest) =>
    set((state) => ({
      guests: state.guests.map((g) => (g.id === guest.id ? guest : g)),
    })),

  addGuest: (guest) =>
    set((state) => {
      const selected = new Set(state.selected);
      if (isSendable(guest, hasMultipleAccounts(state.accounts))) selected.add(guest.id);
      return { guests: [...state.guests, guest], selected };
    }),

  setGuests: (guests) =>
    set((state) => ({
      guests,
      selected: new Set(
        guests.filter((g) => isSendable(g, hasMultipleAccounts(state.accounts))).map((g) => g.id)
      ),
    })),
}));

/** Shared error handling so every mutation reports failures the same way. */
export async function run<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (err) {
    toast.error((err as Error).message);
    return null;
  }
}

export { api, apiJson };
