'use client';

import * as React from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import type { ResolvedGuest, SeatingState, SeatingTable } from '@/lib/types';
import { api, apiJson, run, useApp } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Hint, Input, Label } from '@/components/ui/field';
import { useConfirm } from '@/components/ui/confirm';
import { PlusIcon, TrashIcon, UsersIcon } from '@/components/icons';

/**
 * How many seats a guest's party occupies. A confirmed headcount wins;
 * anyone else (pending, maybe, yes-without-count) is planned as one seat
 * until they say otherwise.
 */
function partySize(guest: ResolvedGuest): number {
  if (guest.rsvpStatus === 'yes' && guest.rsvpCount) return guest.rsvpCount;
  return 1;
}

function seatsUsed(tableId: number, seating: SeatingState, guestById: Map<number, ResolvedGuest>) {
  let used = 0;
  for (const [guestId, assignedTable] of Object.entries(seating.assignments)) {
    if (assignedTable !== tableId) continue;
    const guest = guestById.get(Number(guestId));
    if (guest) used += partySize(guest);
  }
  return used;
}

function GuestChip({
  guest,
  dragging = false,
  overlay = false,
}: {
  guest: ResolvedGuest;
  dragging?: boolean;
  overlay?: boolean;
}) {
  const size = partySize(guest);
  return (
    <span
      className={clsx(
        'inline-flex max-w-full cursor-grab touch-none items-center gap-1.5 rounded-full border border-line bg-surface py-1 ps-1.5 pe-3 text-[0.8125rem] font-medium select-none',
        'transition-[box-shadow,opacity] duration-150',
        overlay && 'cursor-grabbing shadow-lg ring-2 ring-brand/40',
        dragging && 'opacity-30'
      )}
    >
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[0.6875rem] font-semibold text-brand-ink tabular-nums">
        {size}
      </span>
      <span className="truncate">{guest.name}</span>
    </span>
  );
}

function DraggableGuest({ guest, isDragging }: { guest: ResolvedGuest; isDragging: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `guest-${guest.id}`,
    data: { guestId: guest.id },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className="max-w-full">
      <GuestChip guest={guest} dragging={isDragging} />
    </div>
  );
}

function TableCard({
  table,
  guests,
  used,
  onRemove,
  onRename,
  activePartySize,
}: {
  table: SeatingTable;
  guests: ResolvedGuest[];
  used: number;
  onRemove: () => void;
  onRename: (name: string) => void;
  activePartySize: number | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `table-${table.id}`, data: { tableId: table.id } });
  const free = table.capacity - used;
  const wouldOverflow = activePartySize !== null && activePartySize > free;
  const full = free <= 0;

  const [name, setName] = React.useState(table.name);
  React.useEffect(() => setName(table.name), [table.name]);

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'card flex flex-col gap-2.5 p-3.5 transition-[border-color,box-shadow,transform] duration-150 ease-snap',
        isOver && !wouldOverflow && 'border-brand ring-2 ring-brand/30 scale-[1.02]',
        isOver && wouldOverflow && 'border-bad ring-2 ring-bad/30',
        !isOver && full && 'border-good/40'
      )}
    >
      <div className="flex items-center gap-2">
        <input
          value={name}
          aria-label="שם השולחן"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== table.name && onRename(name)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="min-w-0 flex-1 bg-transparent text-[0.9375rem] font-semibold outline-none"
        />
        <Button size="icon" variant="ghost" aria-label={`מחיקת ${table.name}`} className="size-7 text-muted hover:not-disabled:text-bad" onClick={onRemove}>
          <TrashIcon className="size-3.5" />
        </Button>
      </div>

      {/* Seat gauge: fill level doubles as the at-a-glance capacity signal. */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className={clsx(
              'h-full rounded-full transition-[width] duration-300 ease-snap',
              used > table.capacity ? 'bg-bad' : full ? 'bg-good' : 'bg-brand'
            )}
            style={{ width: `${Math.min(100, (used / table.capacity) * 100)}%` }}
          />
        </div>
        <span
          className={clsx(
            'text-[0.75rem] font-medium tabular-nums',
            used > table.capacity ? 'text-bad' : 'text-muted'
          )}
        >
          {used}/{table.capacity}
        </span>
      </div>

      <div className="flex min-h-9 flex-wrap content-start gap-1.5">
        {guests.length === 0 ? (
          <span className="self-center text-[0.75rem] text-muted">גררו לכאן מוזמנים</span>
        ) : (
          guests.map((guest) => <DraggableGuest key={guest.id} guest={guest} isDragging={false} />)
        )}
      </div>
    </div>
  );
}

export function SeatingPanel() {
  const guests = useApp((s) => s.guests);
  const confirm = useConfirm();

  const [seating, setSeating] = React.useState<SeatingState>({ tables: [], assignments: {} });
  const [loaded, setLoaded] = React.useState(false);
  const [tableCount, setTableCount] = React.useState('1');
  const [tableCapacity, setTableCapacity] = React.useState('10');
  const [activeGuestId, setActiveGuestId] = React.useState<number | null>(null);

  // Drag starts only after 6px of movement, so clicking the table name input
  // or a chip doesn't immediately begin a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  React.useEffect(() => {
    run(() => api<SeatingState>('/api/seating')).then((data) => {
      if (data) setSeating(data);
      setLoaded(true);
    });
  }, []);

  const guestById = React.useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);

  // Only people who might actually show up need a seat.
  const seatable = React.useMemo(() => guests.filter((g) => g.rsvpStatus !== 'no'), [guests]);
  const unassigned = seatable.filter((g) => seating.assignments[g.id] === undefined);
  const activeGuest = activeGuestId !== null ? (guestById.get(activeGuestId) ?? null) : null;

  const totalSeats = seating.tables.reduce((sum, t) => sum + t.capacity, 0);
  const totalPeople = seatable.reduce((sum, g) => sum + partySize(g), 0);
  const seatedPeople = seatable
    .filter((g) => seating.assignments[g.id] !== undefined)
    .reduce((sum, g) => sum + partySize(g), 0);

  const { setNodeRef: setPoolRef, isOver: isOverPool } = useDroppable({ id: 'pool' });

  const addTables = async () => {
    const result = await run(() =>
      apiJson<SeatingState>('/api/seating', 'POST', {
        count: Number(tableCount),
        capacity: Number(tableCapacity),
      })
    );
    if (result) {
      setSeating(result);
      toast.success(Number(tableCount) === 1 ? 'השולחן נוסף' : `נוספו ${tableCount} שולחנות`);
    }
  };

  const onDragStart = (event: DragStartEvent) => {
    setActiveGuestId((event.active.data.current as { guestId: number }).guestId);
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveGuestId(null);
    const guestId = (event.active.data.current as { guestId: number }).guestId;
    const guest = guestById.get(guestId);
    if (!guest || !event.over) return;

    const overId = String(event.over.id);
    const currentTable = seating.assignments[guestId];

    if (overId === 'pool') {
      if (currentTable === undefined) return;
      const result = await run(() => apiJson<SeatingState>('/api/seating/assign', 'POST', { guestId, tableId: null }));
      if (result) setSeating(result);
      return;
    }

    const tableId = (event.over.data.current as { tableId: number }).tableId;
    if (tableId === currentTable) return;

    const table = seating.tables.find((t) => t.id === tableId);
    if (!table) return;
    const used = seatsUsed(tableId, seating, guestById);
    if (used + partySize(guest) > table.capacity) {
      toast.error(`אין מספיק מקומות ב${table.name} - נשארו ${table.capacity - used} מתוך ${table.capacity}`);
      return;
    }

    const result = await run(() => apiJson<SeatingState>('/api/seating/assign', 'POST', { guestId, tableId }));
    if (result) setSeating(result);
  };

  const removeTable = async (table: SeatingTable) => {
    const seatedHere = Object.values(seating.assignments).filter((t) => t === table.id).length;
    if (seatedHere > 0) {
      const ok = await confirm({
        title: `למחוק את ${table.name}?`,
        description: `${seatedHere} מוזמנים שהושבו בו יחזרו לרשימת הלא-משובצים.`,
        confirmLabel: 'מחיקה',
        tone: 'danger',
      });
      if (!ok) return;
    }
    const result = await run(() => api<SeatingState>(`/api/seating/tables/${table.id}`, { method: 'DELETE' }));
    if (result) setSeating(result);
  };

  const renameTable = async (table: SeatingTable, name: string) => {
    const result = await run(() => apiJson<SeatingState>(`/api/seating/tables/${table.id}`, 'PATCH', { name }));
    if (result) setSeating(result);
  };

  if (!loaded) return <p className="p-6 text-center text-sm text-muted">טוען סידור הושבה…</p>;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.8125rem] text-muted">
          <span>
            <strong className="text-ink tabular-nums">{seatedPeople}</strong> מתוך{' '}
            <span className="tabular-nums">{totalPeople}</span> אנשים שובצו
          </span>
          <span>
            <strong className="text-ink tabular-nums">{totalSeats}</strong> מקומות ב-
            <span className="tabular-nums">{seating.tables.length}</span> שולחנות
          </span>
          {totalSeats < totalPeople && totalSeats > 0 && (
            <span className="text-warn">חסרים {totalPeople - totalSeats} מקומות</span>
          )}
        </div>

        <div className="card flex flex-wrap items-end gap-3 p-4">
          <div className="w-24">
            <Label htmlFor="table-count">כמה שולחנות</Label>
            <Input
              id="table-count"
              type="number"
              min={1}
              max={100}
              value={tableCount}
              onChange={(e) => setTableCount(e.target.value)}
            />
          </div>
          <div className="w-28">
            <Label htmlFor="table-capacity">מקומות בשולחן</Label>
            <Input
              id="table-capacity"
              type="number"
              min={1}
              max={100}
              value={tableCapacity}
              onChange={(e) => setTableCapacity(e.target.value)}
            />
          </div>
          <Button variant="primary" onClick={addTables}>
            <PlusIcon className="size-4" />
            הוספת שולחנות
          </Button>
          <Hint className="basis-full">
            כל מוזמן תופס מקומות לפי כמות האורחים שאישר (מוזמן שאישר 3 יתפוס 3 מקומות). אפשר לשנות שם
            לשולחן בלחיצה על השם.
          </Hint>
        </div>

        {/* Unassigned pool - also a drop target, to pull someone off a table. */}
        <div
          ref={setPoolRef}
          className={clsx(
            'card flex flex-col gap-2.5 border-dashed p-4 transition-[border-color,box-shadow] duration-150',
            isOverPool && 'border-brand ring-2 ring-brand/30'
          )}
        >
          <div className="flex items-center gap-2 text-[0.8125rem] font-semibold">
            <UsersIcon className="size-4 text-brand" />
            ממתינים לשיבוץ
            <span className="font-normal text-muted tabular-nums">({unassigned.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.length === 0 ? (
              <span className="text-[0.8125rem] text-muted">
                {seatable.length === 0 ? 'אין מוזמנים לשיבוץ עדיין.' : 'כולם שובצו 🎉'}
              </span>
            ) : (
              unassigned.map((guest) => (
                <DraggableGuest key={guest.id} guest={guest} isDragging={guest.id === activeGuestId} />
              ))
            )}
          </div>
        </div>

        {seating.tables.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">
            עדיין אין שולחנות - הוסיפו למעלה כמה שולחנות וכמה מקומות בכל אחד.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {seating.tables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                guests={seatable.filter((g) => seating.assignments[g.id] === table.id)}
                used={seatsUsed(table.id, seating, guestById)}
                onRemove={() => removeTable(table)}
                onRename={(name) => renameTable(table, name)}
                activePartySize={activeGuest ? partySize(activeGuest) : null}
              />
            ))}
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeGuest ? <GuestChip guest={activeGuest} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
