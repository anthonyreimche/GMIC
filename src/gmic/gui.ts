// `#@gui` lines, the way G'MIC-Qt reads them: a filter's settings, one
// `Name = type(arguments)` after another. G'MIC's own filters and the scripts
// written here use the same lines.

import type { Param } from "./params";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Text without markup or entities: G'MIC-Qt names hold <b>, <i> and &amp;. */
export function plain(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] === "#") {
        const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
      }
      return ENTITIES[code.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** Lines with their `\` continuations (onto a following `#` line) joined. */
export function joinContinuations(text: string): string[] {
  return text.replace(/\\\r?\n#\s?/g, "").split(/\r?\n/);
}

/** What follows `#@gui :` on each settings line of `source`. */
export function guiLines(source: string): string[] {
  return joinContinuations(source)
    .map((line) => /^#@gui\s*:(.*)$/.exec(line)?.[1])
    .filter((s): s is string => s !== undefined);
}

const CLOSE: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

/** Where the bracket opened before `start` closes, quotes skipped. Notes can
 *  hold quotes G'MIC never escapes; then the line's last closing bracket is
 *  taken, as each setting has a line of its own. */
function closing(s: string, start: number, close: string): number {
  let quoted = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") i++;
    else if (c === '"') quoted = !quoted;
    else if (!quoted && c === close) return i;
  }
  const last = s.lastIndexOf(close);
  return last >= start ? last : -1;
}

function splitArgs(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length) {
      cur += s[++i];
    } else if (c === '"') {
      quoted = !quoted;
    } else if (c === "," && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  if (cur.trim() !== "" || out.length > 0) out.push(cur.trim());
  return out;
}

const n = (s: string | undefined, fallback: number) => {
  const v = Number(s);
  return s !== undefined && s.trim() !== "" && Number.isFinite(v) ? v : fallback;
};

function colour(args: string[]): number[] {
  const hex = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(args[0] ?? "");
  if (hex) return hex[1].match(/../g)!.map((h) => parseInt(h, 16));
  const values = args.map((a) => n(a, 0));
  return values.length >= 3 ? values.slice(0, 4) : [0, 0, 0];
}

const unquoted = (s: string) => (s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s);

function toParam(name: string, type: string, args: string[], pos: number, inner: string): { param: Param; slots: number } | null {
  switch (type) {
    case "float":
    case "int":
      return { param: { kind: type, name, pos, default: n(args[0], 0), min: n(args[1], 0), max: n(args[2], 1) }, slots: 1 };
    case "bool": {
      const a = (args[0] ?? "").toLowerCase();
      return { param: { kind: "bool", name, pos, default: a === "1" || a === "true" }, slots: 1 };
    }
    case "choice": {
      const numbered = args.length > 0 && /^\d+$/.test(args[0]);
      const choices = (numbered ? args.slice(1) : args).map(plain);
      return { param: { kind: "choice", name, pos, default: numbered ? Number(args[0]) : 0, choices }, slots: 1 };
    }
    case "color": {
      const value = colour(args);
      return { param: { kind: "color", name, pos, default: value }, slots: value.length };
    }
    case "point":
      return { param: { kind: "point", name, pos, default: [n(args[0], 50), n(args[1], 50)] }, slots: 2 };
    case "text": {
      const value = args.length >= 2 && /^[01]$/.test(args[0]) ? args[1] : (args[0] ?? "");
      return { param: { kind: "text", name, pos, default: value }, slots: 1 };
    }
    case "file":
    case "filein":
    case "fileout":
    case "folder":
      return { param: { kind: "fixed", name, pos, value: `"${(args[0] ?? "").replace(/"/g, '\\"')}"` }, slots: 1 };
    case "button":
      return { param: { kind: "fixed", name, pos, value: "0" }, slots: 1 };
    case "value":
      return { param: { kind: "fixed", name, pos, value: `"${unquoted(inner.trim()).replace(/(^|[^\\])"/g, '$1\\"')}"` }, slots: 1 };
    default:
      return null;
  }
}

const ENTRY_HEAD = /\s*,?\s*([^=,]+?)\s*=\s*[_~]*([A-Za-z]+)\s*([([{])/y;

/** The settings the `#@gui :` lines describe, numbered by argument position.
 *  Kinds G'MIC-Qt knows but this can't show are left out. */
export function guiParams(lines: readonly string[]): Param[] {
  const params: Param[] = [];
  let pos = 1;
  for (const line of lines) {
    let at = 0;
    while (at < line.length) {
      ENTRY_HEAD.lastIndex = at;
      const head = ENTRY_HEAD.exec(line);
      if (!head) break;
      const [, rawName, type, open] = head;
      const end = closing(line, ENTRY_HEAD.lastIndex, CLOSE[open]);
      if (end < 0) break;
      const inner = line.slice(ENTRY_HEAD.lastIndex, end);
      const args = splitArgs(inner);
      const name = plain(rawName);
      at = end + 1;
      if (type === "separator") params.push({ kind: "separator" });
      else if (type === "note") params.push({ kind: "note", text: plain(args.join(",")) });
      else if (type === "link") params.push({ kind: "link", name: args.length > 1 ? plain(args[args.length - 2]) : name, url: args[args.length - 1] ?? "" });
      else {
        const made = toParam(name, type, args, pos, inner);
        if (!made) continue;
        params.push(made.param);
        pos += made.slots;
      }
    }
  }
  return params;
}
