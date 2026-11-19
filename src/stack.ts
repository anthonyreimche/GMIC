// What a photo's edit runs through G'MIC. The installed filters and scripts
// are kept in the extension's settings, in the order they apply; each is a
// Develop panel. A photo's own use of one, switched on or off with its values,
// is kept in the photo's bag under the panel's key, so undo, copy and paste
// and that panel's preview eye carry it like any other stage value.

import type { Filter } from "./gmic/catalogue";
import { defaultsOf, type ParamValue, type ParamValues } from "./gmic/params";
import { scriptParams } from "./gmic/script";

export const STAGE_ID = "gmic";

/** An installed filter from G'MIC's list, named by its command: its settings
 *  come from the list when it runs. */
export interface FilterItem {
  id: string;
  kind: "filter";
  name: string;
  command: string;
}

/** An installed script, its source kept with it. */
export interface ScriptItem {
  id: string;
  kind: "script";
  name: string;
  source: string;
}

export type Item = FilterItem | ScriptItem;

/** A photo's use of one item. */
export interface ItemState {
  on: boolean;
  values: ParamValues;
  /** What was drawn for an interactive filter (curves, points), as its
   *  editor keeps it. */
  data?: unknown;
}

/** One item as a photo runs it. */
export type Step = Item & ItemState;
export type Stack = readonly Step[];

type Settings = { get<T>(key: string, fallback: T): T; set(key: string, value: unknown): void };

export const INSTALLED = "installed";

/** The bag key, and the panel id, of an installed item. */
export const itemKey = (id: string): string => `${STAGE_ID}.f.${id}`;

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

function isItem(v: unknown): v is Item {
  if (!isRecord(v) || typeof v.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(v.id) || typeof v.name !== "string") return false;
  if (v.kind === "filter") return typeof v.command === "string";
  if (v.kind === "script") return typeof v.source === "string";
  return false;
}

export function readInstalled(settings: Pick<Settings, "get">): Item[] {
  const stored = settings.get<unknown>(INSTALLED, []);
  if (!Array.isArray(stored)) return [];
  const seen = new Set<string>();
  return stored.filter((v): v is Item => isItem(v) && !seen.has(v.id) && Boolean(seen.add(v.id)));
}

export function writeInstalled(settings: Pick<Settings, "set">, items: readonly Item[]): void {
  settings.set(
    INSTALLED,
    items.map((i) => (i.kind === "filter" ? { id: i.id, kind: i.kind, name: i.name, command: i.command } : { id: i.id, kind: i.kind, name: i.name, source: i.source })),
  );
}

export const newId = (): string => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

/** Installs `filter` at the end, unless it already is. */
export function installFilter(items: readonly Item[], filter: Filter, makeId: () => string = newId): Item[] {
  if (items.some((i) => i.kind === "filter" && i.command === filter.command)) return [...items];
  return [...items, { id: makeId(), kind: "filter", name: filter.name, command: filter.command }];
}

export function installScript(items: readonly Item[], name: string, source: string, makeId: () => string = newId): Item[] {
  return [...items, { id: makeId(), kind: "script", name, source }];
}

export const uninstall = (items: readonly Item[], id: string): Item[] => items.filter((i) => i.id !== id);

/** The list with `id` moved to `index` (clamped), the rest in order. */
export function moveItem<T extends { id: string }>(items: readonly T[], id: string, index: number): T[] {
  const item = items.find((i) => i.id === id);
  if (!item) return [...items];
  const rest = items.filter((i) => i.id !== id);
  const at = Math.max(0, Math.min(rest.length, index));
  return [...rest.slice(0, at), item, ...rest.slice(at)];
}

export function updateScript(items: readonly Item[], id: string, patch: Partial<Pick<ScriptItem, "name" | "source">>): Item[] {
  return items.map((i) => (i.id === id && i.kind === "script" ? { ...i, ...patch } : i));
}

/** A photo's use of item `id`, or null where it has none. */
export function readState(bag: Readonly<Record<string, unknown>> | null | undefined, id: string): ItemState | null {
  const v = bag?.[itemKey(id)];
  if (!isRecord(v) || typeof v.on !== "boolean" || !isRecord(v.values)) return null;
  return v.data === undefined ? { on: v.on, values: v.values as ParamValues } : { on: v.on, values: v.values as ParamValues, data: v.data };
}

export const statePatch = (id: string, state: ItemState): Record<string, unknown> => ({ [itemKey(id)]: state });

export function withValue(state: ItemState | null, name: string, value: ParamValue): ItemState {
  const values = { ...(state?.values ?? {}), [name]: value };
  return state?.data === undefined ? { on: true, values } : { on: true, values, data: state.data };
}

/** A drawing changed while off switches the item on, as a setting does. */
export function withData(state: ItemState | null, data: unknown): ItemState {
  return { on: true, values: state?.values ?? {}, data };
}

/** The steps a photo runs, in the installed order: the items it has switched
 *  on, less any `skip` names (a panel held off). */
export function photoSteps(items: readonly Item[], bag: Readonly<Record<string, unknown>> | null | undefined, skip?: (id: string) => boolean): Step[] {
  const steps: Step[] = [];
  for (const item of items) {
    const state = readState(bag, item.id);
    if (state?.on && !skip?.(item.id)) steps.push({ ...item, ...state });
  }
  return steps;
}

export const enabledSteps = (stack: Stack): Step[] => stack.filter((s) => s.on);

/** A filter's settings at their defaults, for a new install or a reset. */
export const filterDefaults = (filter: Filter): ParamValues => defaultsOf(filter.params);
export const scriptDefaults = (source: string): ParamValues => defaultsOf(scriptParams(source));
