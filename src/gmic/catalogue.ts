// G'MIC's filter list, read the way G'MIC-Qt reads it: from the `#@gui` lines
// of the filter definitions G'MIC's update downloads. `#@gui <folder>` opens a
// folder inside the open one, each leading underscore first stepping out one
// (`#@gui _` alone just steps out); `#@gui Name : command, preview` starts a
// filter, and `#@gui : …` lines are its settings.

import { guiParams, joinContinuations, plain } from "./gui";
import type { Param } from "./params";

export interface Filter {
  name: string;
  category: string;
  command: string;
  params: Param[];
}

export interface Category {
  name: string;
  filters: Filter[];
}

export interface Catalogue {
  version: string;
  categories: Category[];
}

interface Pending {
  name: string;
  category: string;
  command: string;
  lines: string[];
}

export function parseFilterFile(text: string): Catalogue {
  const version = /for version (\d+(?:\.\d+)*)/.exec(text.slice(0, 2000))?.[1] ?? "";
  const byCategory = new Map<string, Filter[]>();
  const folders: string[] = [];
  let current: Pending | null = null;

  const finish = () => {
    if (!current) return;
    const { name, category, command, lines } = current;
    current = null;
    if (!command || command === "_none_" || !category) return;
    const list = byCategory.get(category) ?? [];
    list.push({ name, category, command, params: guiParams(lines) });
    byCategory.set(category, list);
  };

  for (const line of joinContinuations(text)) {
    const m = /^#@gui (.*)$/.exec(line);
    if (!m) continue;
    const body = m[1];
    if (/^\s*:/.test(body)) {
      current?.lines.push(body.replace(/^\s*:/, ""));
      continue;
    }
    finish();
    const colon = body.indexOf(":");
    if (colon < 0) {
      const up = /^_*/.exec(body)![0].length;
      folders.length = Math.max(0, folders.length - up);
      const name = plain(body.slice(up));
      if (name) folders.push(name);
      continue;
    }
    const command = body.slice(colon + 1).split(",")[0].split(":")[0].trim();
    current = { name: plain(body.slice(0, colon)), category: folders.join(" › "), command, lines: [] };
  }
  finish();

  return { version, categories: [...byCategory].map(([name, filters]) => ({ name, filters })) };
}

export function allFilters(catalogue: Catalogue): Filter[] {
  return catalogue.categories.flatMap((c) => c.filters);
}

/** A filter by its name (any case) or its command. */
export function findFilter(catalogue: Catalogue, nameOrCommand: string): Filter | null {
  const key = nameOrCommand.trim().toLowerCase();
  const filters = allFilters(catalogue);
  return (
    filters.find((f) => f.name.toLowerCase() === key) ?? filters.find((f) => f.command.toLowerCase() === key) ?? null
  );
}

/** Filters whose name, category or command hold every word of `query`. */
export function searchFilters(catalogue: Catalogue, query: string): Filter[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return allFilters(catalogue).filter((f) => {
    const hay = `${f.name} ${f.category} ${f.command}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
