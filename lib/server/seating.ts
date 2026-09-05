import fs from 'node:fs';
import path from 'node:path';
import { singleton } from './singleton';
import { workspaceDataDir, writeJsonAtomic } from './dataDir';

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

const states = singleton<Map<string, State>>('seating-workspaces', () => new Map());

function dataFile(workspaceId: string): string {
  return path.join(workspaceDataDir(workspaceId), 'seating.json');
}

function stateFor(workspaceId: string): State {
  const existing = states.get(workspaceId);
  if (existing) return existing;

  let state: State;
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile(workspaceId), 'utf8')) as Partial<State>;
    const tables = Array.isArray(parsed.tables) ? parsed.tables : [];
    state = {
      tables,
      assignments: parsed.assignments && typeof parsed.assignments === 'object' ? parsed.assignments : {},
      nextTableId: tables.reduce((max, table) => Math.max(max, table.id), 0) + 1,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Failed to load seating chart, starting empty:', (error as Error).message);
    }
    state = emptyState();
  }
  states.set(workspaceId, state);
  return state;
}

function save(workspaceId: string, state: State): void {
  try {
    writeJsonAtomic(dataFile(workspaceId), { tables: state.tables, assignments: state.assignments });
  } catch (error) {
    console.error('Failed to save seating chart:', (error as Error).message);
  }
}

export function get(workspaceId: string): { tables: SeatingTable[]; assignments: Record<number, number> } {
  const state = stateFor(workspaceId);
  return { tables: state.tables, assignments: state.assignments };
}

export function addTables(workspaceId: string, count: number, capacity: number, baseName?: string): SeatingTable[] {
  const state = stateFor(workspaceId);
  const added: SeatingTable[] = [];
  for (let index = 0; index < count; index++) {
    const id = state.nextTableId++;
    added.push({
      id,
      name: baseName?.trim() ? (count === 1 ? baseName.trim() : `${baseName.trim()} ${id}`) : `שולחן ${id}`,
      capacity,
    });
  }
  state.tables.push(...added);
  save(workspaceId, state);
  return added;
}

export function updateTable(
  workspaceId: string,
  id: number,
  patch: Partial<Pick<SeatingTable, 'name' | 'capacity'>>
): SeatingTable | null {
  const state = stateFor(workspaceId);
  const table = state.tables.find((item) => item.id === id);
  if (!table) return null;
  if (patch.name !== undefined && patch.name.trim()) table.name = patch.name.trim();
  if (patch.capacity !== undefined && patch.capacity > 0) table.capacity = Math.floor(patch.capacity);
  save(workspaceId, state);
  return table;
}

export function removeTable(workspaceId: string, id: number): boolean {
  const state = stateFor(workspaceId);
  const index = state.tables.findIndex((table) => table.id === id);
  if (index === -1) return false;
  state.tables.splice(index, 1);
  for (const [guestId, tableId] of Object.entries(state.assignments)) {
    if (tableId === id) delete state.assignments[Number(guestId)];
  }
  save(workspaceId, state);
  return true;
}

/** tableId null moves the guest back to the unassigned pool. */
export function assign(workspaceId: string, guestId: number, tableId: number | null): void {
  const state = stateFor(workspaceId);
  if (tableId === null) {
    delete state.assignments[guestId];
  } else {
    state.assignments[guestId] = tableId;
  }
  save(workspaceId, state);
}

export function tableExists(workspaceId: string, tableId: number): boolean {
  return stateFor(workspaceId).tables.some((table) => table.id === tableId);
}

/** Drop assignments for guests that no longer exist (deleted, list re-uploaded). */
export function pruneAssignments(workspaceId: string, validGuestIds: Set<number>): void {
  const state = stateFor(workspaceId);
  let changed = false;
  for (const guestId of Object.keys(state.assignments)) {
    if (!validGuestIds.has(Number(guestId))) {
      delete state.assignments[Number(guestId)];
      changed = true;
    }
  }
  if (changed) save(workspaceId, state);
}
