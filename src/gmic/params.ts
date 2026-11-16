// A G'MIC filter's parameters, as G'MIC-Qt shows them, and the argument list
// they make. `pos` is the parameter's first slot in the filter's arguments: a
// colour takes three or four slots, a point two, the rest one.

export type Param =
  | { kind: "float" | "int"; name: string; pos: number; default: number; min: number; max: number }
  | { kind: "bool"; name: string; pos: number; default: boolean }
  | { kind: "choice"; name: string; pos: number; default: number; choices: string[] }
  | { kind: "color"; name: string; pos: number; default: number[] }
  | { kind: "point"; name: string; pos: number; default: [number, number] }
  | { kind: "text"; name: string; pos: number; default: string }
  /** A slot the person can't set here (a file, folder, button or fixed value):
   *  passed as written. */
  | { kind: "fixed"; name: string; pos: number; value: string }
  | { kind: "note"; text: string }
  | { kind: "link"; name: string; url: string }
  | { kind: "separator" };

export type SettableParam = Exclude<Param, { kind: "fixed" | "note" | "link" | "separator" }>;
export type ParamValue = number | boolean | string | number[];
export type ParamValues = Record<string, ParamValue>;

export function isSettable(p: Param): p is SettableParam {
  return p.kind !== "fixed" && p.kind !== "note" && p.kind !== "link" && p.kind !== "separator";
}

export function defaultsOf(params: readonly Param[]): ParamValues {
  const values: ParamValues = {};
  for (const p of params) if (isSettable(p)) values[p.name] = Array.isArray(p.default) ? [...p.default] : p.default;
  return values;
}

/** A number as G'MIC reads it: no exponent, no trailing zeros. */
export function num(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
}

/** A word as G'MIC reads it: in double quotes when it is empty or holds a
 *  space, a comma or a quote. */
export function quote(word: string): string {
  if (word !== "" && !/[\s",]/.test(word)) return word;
  return `"${word.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function textArg(text: string): string {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Console words joined into one G'MIC command line. */
export function gmicLine(words: readonly string[]): string {
  return words.map((w) => (/[\s"]/.test(w) || w === "" ? quote(w) : w)).join(" ");
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function slotsOf(p: Param, values: ParamValues): string[] {
  if (p.kind === "fixed") return [p.value];
  if (!isSettable(p)) return [];
  const v = values[p.name] ?? p.default;
  switch (p.kind) {
    case "float":
      return [num(clamp(Number(v), p.min, p.max))];
    case "int":
      return [num(Math.round(clamp(Number(v), p.min, p.max)))];
    case "bool":
      return [v === true ? "1" : "0"];
    case "choice":
      return [num(clamp(Math.round(Number(v)), 0, p.choices.length - 1))];
    case "color":
    case "point":
      return (Array.isArray(v) ? v : p.default).map(num);
    case "text":
      return [textArg(String(v))];
  }
}

/** The filter's arguments, comma-separated in position order. */
export function argList(params: readonly Param[], values: ParamValues): string {
  const placed = params
    .filter((p): p is Extract<Param, { pos: number }> => "pos" in p)
    .sort((a, b) => a.pos - b.pos);
  return placed.flatMap((p) => slotsOf(p, values)).join(",");
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const wordsOf = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

function matching(params: readonly SettableParam[], key: string): SettableParam[] {
  const k = squash(key);
  const exact = params.filter((p) => squash(p.name) === k);
  if (exact.length > 0) return exact;
  return params.filter((p) => squash(p.name).startsWith(k) || wordsOf(p.name).some((w) => w.startsWith(k)));
}

function parseNumber(p: SettableParam, raw: string): number {
  const n = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(n)) throw new Error(`${p.name} takes a number, not "${raw}".`);
  return n;
}

function parseNumbers(p: SettableParam, raw: string, count: number | null): number[] {
  const hex = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(raw);
  if (hex) return hex[1].match(/../g)!.map((h) => parseInt(h, 16));
  const parts = raw.split(",").map((s) => Number(s));
  if (parts.some((n) => !Number.isFinite(n)) || (count !== null && parts.length !== count)) {
    const shape = count === 2 ? "x,y" : "#rrggbb or r,g,b";
    throw new Error(`${p.name} takes ${shape}, not "${raw}".`);
  }
  return parts;
}

const TRUE = new Set(["1", "on", "yes", "true"]);
const FALSE = new Set(["0", "off", "no", "false"]);

function parseValue(p: SettableParam, raw: string): ParamValue {
  switch (p.kind) {
    case "float":
    case "int":
      return parseNumber(p, raw);
    case "bool": {
      const r = raw.toLowerCase();
      if (TRUE.has(r)) return true;
      if (FALSE.has(r)) return false;
      throw new Error(`${p.name} takes on or off, not "${raw}".`);
    }
    case "choice": {
      const byLabel = p.choices.findIndex((c) => squash(c) === squash(raw));
      if (byLabel >= 0) return byLabel;
      const n = Number(raw);
      if (Number.isInteger(n) && n >= 0 && n < p.choices.length) return n;
      throw new Error(`${p.name} takes one of ${p.choices.join(", ")}.`);
    }
    case "color":
      return parseNumbers(p, raw, null);
    case "point": {
      const [x, y] = parseNumbers(p, raw, 2);
      return [x, y];
    }
    case "text":
      return raw;
  }
}

/** Values from `Name=value` words: the defaults, with each named one set. A
 *  name matches a parameter's whole name, or the start of one of its words,
 *  ignoring case, spaces and punctuation. */
export function valuesFromAssignments(params: readonly Param[], words: readonly string[]): ParamValues {
  const settable = params.filter(isSettable);
  const values = defaultsOf(params);
  for (const word of words) {
    const eq = word.indexOf("=");
    if (eq <= 0) throw new Error(`"${word}" isn't a value: write Name=value.`);
    const key = word.slice(0, eq);
    const found = matching(settable, key);
    if (found.length === 0) {
      const names = settable.map((p) => p.name).join(", ");
      throw new Error(`No parameter "${key}".${names ? ` It has: ${names}.` : " It has none."}`);
    }
    if (found.length > 1) throw new Error(`"${key}" could be ${found.map((p) => p.name).join(" or ")}.`);
    values[found[0].name] = parseValue(found[0], word.slice(eq + 1));
  }
  return values;
}
