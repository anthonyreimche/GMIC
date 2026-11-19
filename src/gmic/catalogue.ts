// G'MIC's filter list, read the way G'MIC-Qt reads it: from the `#@gui` lines
// of the filter definitions G'MIC's update downloads. `#@gui <folder>` opens a
// folder inside the open one, each leading underscore first stepping out one
// (`#@gui _` alone just steps out); `#@gui Name : command, preview` starts a
// filter, and `#@gui : …` lines are its settings.

import { guiParams, joinContinuations, plain } from "./gui";
import type { Param } from "./params";

/** Where a filter's preview matches its result, from the flag after its
 *  preview command as G'MIC-Qt reads it: "any" zoom; "actual", at 100 % (its
 *  settings are in pixels); "whole", with the whole photo in view. */
export type PreviewScale = "any" | "actual" | "whole";

export interface Filter {
  name: string;
  category: string;
  command: string;
  params: Param[];
  previewScale: PreviewScale;
  /** The command G'MIC-Qt previews with, or null for none. Left out: the
   *  filter's own command. */
  preview?: string | null;
  /** The command opens G'MIC's own window to draw in (Curves, Warp …); its
   *  preview command replays what was drawn without it. */
  interactive?: boolean;
}

/** `preview(factor)` with no `+` or `*` after it is true at one zoom only:
 *  factor 0 at 100 %, any other with the whole image shown. */
export function previewScaleOf(previewCommand: string | undefined): PreviewScale {
  const flag = /\(\s*([\d.]+)\s*\)\s*([+*]?)\s*$/.exec((previewCommand ?? "").split(":")[0]);
  if (!flag || flag[2]) return "any";
  return Number(flag[1]) === 0 ? "actual" : "whole";
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
  preview: string | null;
  previewScale: PreviewScale;
  lines: string[];
}

const NO_PREVIEW = new Set(["", "_none_", "gui_no_preview"]);

/** The preview command's name, without its zoom flag or input mode. */
function previewName(raw: string | undefined, command: string): string | null {
  if (raw === undefined) return command;
  const name = raw.split(":")[0].replace(/\(.*$/, "").trim();
  return NO_PREVIEW.has(name) ? null : name;
}

/** Commands whose definition opens G'MIC's own window first. */
function interactiveCommands(text: string): Set<string> {
  return new Set([...text.matchAll(/^([A-Za-z_][A-Za-z0-9_]*)\s*:[^\n]*\bgui_check_x11_gdi32\s+0\b/gm)].map((m) => m[1]));
}

export function parseFilterFile(text: string): Catalogue {
  const version = /for version (\d+(?:\.\d+)*)/.exec(text.slice(0, 2000))?.[1] ?? "";
  const byCategory = new Map<string, Filter[]>();
  const folders: string[] = [];
  const interactive = interactiveCommands(text);
  let current: Pending | null = null;

  const finish = () => {
    if (!current) return;
    const { name, category, command, preview, previewScale, lines } = current;
    current = null;
    if (!command || command === "_none_" || !category) return;
    const list = byCategory.get(category) ?? [];
    list.push({ name, category, command, params: guiParams(lines), previewScale, preview, interactive: interactive.has(command) });
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
    const commands = body.slice(colon + 1).split(",");
    const command = commands[0].split(":")[0].trim();
    current = { name: plain(body.slice(0, colon)), category: folders.join(" › "), command, preview: previewName(commands[1], command), previewScale: previewScaleOf(commands[1]), lines: [] };
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

/** The filter a command runs. */
export function filterByCommand(catalogue: Catalogue, command: string): Filter | null {
  return allFilters(catalogue).find((f) => f.command === command) ?? null;
}

/** Filters whose name, category or command hold every word of `query`. */
export function searchFilters(catalogue: Catalogue, query: string): Filter[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return allFilters(catalogue).filter((f) => {
    const hay = `${f.name} ${f.category} ${f.command}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
