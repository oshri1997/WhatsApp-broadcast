export type RsvpStatus = 'yes' | 'no' | 'maybe';

export interface Guest {
  id: number;
  name: string;
  phone: string | null;
  phoneRaw: string;
  side: string;
  valid: boolean;
  customMessage?: string | null;
  rsvpStatus: RsvpStatus | null;
  rsvpCount: number | null;
  rsvpAwaitingCount: boolean;
  invited: boolean;
}

/** A guest plus the WhatsApp account its "side" resolves to, computed per request. */
export interface ResolvedGuest extends Guest {
  resolvedAccountId: string | null;
  resolvedAccountLabel: string | null;
}

export type AccountStatus = 'INITIALIZING' | 'QR' | 'AUTHENTICATED' | 'READY' | 'DISCONNECTED';

export interface AccountView {
  id: string;
  label: string;
  status: AccountStatus;
  qrDataUrl: string | null;
  /** The WhatsApp number this connection is linked to, known once READY. */
  phone: string | null;
}

export interface SendFailure {
  name: string;
  phone: string;
  reason: string;
}

export interface SendJob {
  id: string;
  total: number;
  sent: number;
  failed: SendFailure[];
  current: string | null;
  status: 'running' | 'done';
  error?: string;
}

export type MediaKind = 'image' | 'video';

export interface InvitationMediaView {
  url: string | null;
  kind: MediaKind | null;
  filename: string | null;
}

export type RsvpFilter = '' | RsvpStatus | 'pending' | 'not-invited';

export interface SeatingTable {
  id: number;
  name: string;
  capacity: number;
}

export interface SeatingState {
  tables: SeatingTable[];
  /** guestId -> tableId */
  assignments: Record<number, number>;
}
