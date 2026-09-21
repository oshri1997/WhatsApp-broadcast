import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MESSAGE_TEMPLATES } from '@/lib/templates';
import type { SavedMessageTemplate } from '@/lib/types';
import { workspaceDataDir, writeJsonAtomic } from './dataDir';
import { singleton } from './singleton';

const FILE_NAME = 'message-templates.json';
const states = singleton<Map<string, SavedMessageTemplate[]>>('messageTemplates-workspaces', () => new Map());

function dataFile(workspaceId: string) {
  return path.join(workspaceDataDir(workspaceId), FILE_NAME);
}

function defaults(): SavedMessageTemplate[] {
  const now = new Date().toISOString();
  return MESSAGE_TEMPLATES.map((template, index) => ({
    id: `starter-${index + 1}`,
    label: template.label,
    text: template.text,
    createdAt: now,
    updatedAt: now,
  }));
}

function stateFor(workspaceId: string) {
  const existing = states.get(workspaceId);
  if (existing) return existing;
  let templates: SavedMessageTemplate[];
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(dataFile(workspaceId), 'utf8'));
    templates = Array.isArray(parsed) ? parsed as SavedMessageTemplate[] : defaults();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Failed to load saved message templates:', (error as Error).message);
    }
    templates = defaults();
  }
  states.set(workspaceId, templates);
  return templates;
}

function save(workspaceId: string) {
  try {
    writeJsonAtomic(dataFile(workspaceId), stateFor(workspaceId));
  } catch (error) {
    console.error('Failed to save message templates:', (error as Error).message);
  }
}

export function list(workspaceId: string) {
  return stateFor(workspaceId);
}

export function create(workspaceId: string, label: string, text: string): SavedMessageTemplate {
  const now = new Date().toISOString();
  const template = {
    id: crypto.randomUUID(),
    label,
    text,
    createdAt: now,
    updatedAt: now,
  } satisfies SavedMessageTemplate;
  stateFor(workspaceId).push(template);
  save(workspaceId);
  return template;
}

export function update(workspaceId: string, id: string, patch: Pick<SavedMessageTemplate, 'label' | 'text'>): SavedMessageTemplate | null {
  const template = stateFor(workspaceId).find((item) => item.id === id);
  if (!template) return null;
  template.label = patch.label;
  template.text = patch.text;
  template.updatedAt = new Date().toISOString();
  save(workspaceId);
  return template;
}

export function remove(workspaceId: string, id: string): boolean {
  const templates = stateFor(workspaceId);
  const index = templates.findIndex((item) => item.id === id);
  if (index === -1) return false;
  templates.splice(index, 1);
  save(workspaceId);
  return true;
}
