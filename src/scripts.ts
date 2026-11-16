// Saved scripts, kept in this extension's settings. Settings reach the
// `safelight` command line too, so a script saved here runs there as well.

import type { SafelightAPI } from "./safelight";

export interface Script {
  id: string;
  name: string;
  source: string;
}

type Settings = Pick<SafelightAPI["settings"], "get" | "set">;

const KEY = "scripts";

function isScript(value: unknown): value is Script {
  if (value === null || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return typeof s.id === "string" && typeof s.name === "string" && typeof s.source === "string";
}

export function readScripts(settings: Settings): Script[] {
  const stored = settings.get<unknown>(KEY, []);
  return Array.isArray(stored) ? stored.filter(isScript) : [];
}

export function writeScripts(settings: Settings, scripts: readonly Script[]): void {
  settings.set(KEY, scripts.map(({ id, name, source }) => ({ id, name, source })));
}

/** A script by its name, ignoring case and extra spaces. */
export function findScript(scripts: readonly Script[], name: string): Script | null {
  const key = name.trim().replace(/\s+/g, " ").toLowerCase();
  return scripts.find((s) => s.name.trim().replace(/\s+/g, " ").toLowerCase() === key) ?? null;
}

/** A name not yet taken: `base`, else `base 2`, `base 3` and on. */
export function freeName(scripts: readonly Script[], base: string): string {
  if (!findScript(scripts, base)) return base;
  for (let n = 2; ; n++) if (!findScript(scripts, `${base} ${n}`)) return `${base} ${n}`;
}

export const NEW_SCRIPT = `#@gui : Strength = float(2,0,10)
# A G'MIC script. Each line is G'MIC words, run on the photo in turn;
# #@gui lines above give it settings, read here as $1, $2 and on.
blur $1
`;
