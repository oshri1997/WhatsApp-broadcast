import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './dataDir';
import { singleton } from './singleton';

// Seating chart state: the tables the organizer created plus which guest sits
// at which table. Each guest is seated as one unit.
// Persisted like the guest list so a restart doesn't wipe the chart.
const DATA_FILE = path.join(DATA_DIR, 'seating.json');

export interface SeatingTable {
  id: number;
  name: string;
  capacity: number;
}

interface State {
  tables: SeatingTable[];
  /** guestId -> tableId */
  assignments: Record<number, number>;
  nextTableId: number;
}

function emptyState(): State {
  return { tables: [], assignments: {}, nextTableId: 1 };
}

const state = singleton<State>('seating', () => {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as Partial<State>;
    const tables = Array.isArray(parsed.tables) ? parsed.tables : [];
    return {
      tables,
      assignments: parsed.assignments && typeof parsed.assignments === 'object' ? parsed.assignments : {},
      nextTableId: tables.reduce((max, t) => Math.max(max, t.id), 0) + 1,
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Failed to load seating chart, starting empty:', (err as Error).message);
    }
    return emptyState();
  }
});

function save() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ tables: state.tables, assignments: state.assignments }, null, 2)
    );
  } catch (err) {
    console.error('Failed to save seating chart:', (err as Error).message);
  }
}

export function get(): { tables: SeatingTable[]; assignments: Record<number, number> } {
  return { tables: state.tables, assignments: state.assignments };
}

export function addTables(count: number, capacity: number, baseName?: string): SeatingTable[] {
  const added: SeatingTable[] = [];
  for (let i = 0; i < count; i++) {
    const id = state.nextTableId++;
    added.push({
      id,
      name: baseName?.trim() ? (count === 1 ? baseName.trim() : `${baseName.trim()} ${id}`) : `שולחן ${id}`,
      capacity,
    });
  }
  state.tables.push(...added);
  save();
  return added;
}

export function updateTable(
  id: number,
  patch: Partial<Pick<SeatingTable, 'name' | 'capacity'>>
): SeatingTable | null {
  const table = state.tables.find((t) => t.id === id);
  if (!table) return null;
  if (patch.name !== undefined && patch.name.trim()) table.name = patch.name.trim();
  if (patch.capacity !== undefined && patch.capacity > 0) table.capacity = Math.floor(patch.capacity);
  save();
  return table;
}

export function removeTable(id: number): boolean {
  const idx = state.tables.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  state.tables.splice(idx, 1);
  // Guests seated there go back to the unassigned pool.
  for (const [guestId, tableId] of Object.entries(state.assignments)) {
    if (tableId === id) delete state.assignments[Number(guestId)];
  }
  save();
  return true;
}

/** tableId null moves the guest back to the unassigned pool. */
export function assign(guestId: number, tableId: number | null): void {
  if (tableId === null) {
    delete state.assignments[guestId];
  } else {
    state.assignments[guestId] = tableId;
  }
  save();
}

export function tableExists(tableId: number): boolean {
  return state.tables.some((t) => t.id === tableId);
}

/** Drop assignments for guests that no longer exist (deleted, list re-uploaded). */
export function pruneAssignments(validGuestIds: Set<number>): void {
  let changed = false;
  for (const guestId of Object.keys(state.assignments)) {
    if (!validGuestIds.has(Number(guestId))) {
      delete state.assignments[Number(guestId)];
      changed = true;
    }
  }
  if (changed) save();
}
