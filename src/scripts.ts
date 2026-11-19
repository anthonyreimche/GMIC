// Scripts by name, for the gmic command, and the scripts G'MIC 1.0 kept in
// settings of their own (installed items now).

import type { SafelightAPI } from "./safelight";

export interface Script {
  id: string;
  name: string;
  source: string;
}

type Settings = Pick<SafelightAPI["settings"], "get" | "set">;

export const LEGACY_SCRIPTS = "scripts";

function isScript(value: unknown): value is Script {
  if (value === null || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return typeof s.id === "string" && typeof s.name === "string" && typeof s.source === "string";
}

export function readLegacyScripts(settings: Settings): Script[] {
  const stored = settings.get<unknown>(LEGACY_SCRIPTS, []);
  return Array.isArray(stored) ? stored.filter(isScript) : [];
}

/** A script by its name, ignoring case and extra spaces. */
export function findScript(scripts: readonly Script[], name: string): Script | null {
  const key = name.trim().replace(/\s+/g, " ").toLowerCase();
  return scripts.find((s) => s.name.trim().replace(/\s+/g, " ").toLowerCase() === key) ?? null;
}

export const NEW_SCRIPT = `#@gui : Strength = float(2,0,10)
# A G'MIC script. Each line is G'MIC words, run on the photo in turn;
# #@gui lines above give it settings, read here as $1, $2 and on.
blur $1
`;
