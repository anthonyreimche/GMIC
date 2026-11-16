// The `gmic` command's words: a subcommand, or G'MIC words to run.

import { gmicLine } from "./params";

export type Action =
  | { kind: "usage" }
  | { kind: "pipeline"; line: string }
  | { kind: "filters"; search: string }
  | { kind: "filter"; name: string; assignments: string[] }
  | { kind: "script"; name: string | null; source: string | null; assignments: string[] }
  | { kind: "scripts" }
  | { kind: "help"; topic: string }
  | { kind: "status" }
  | { kind: "update" };

export const SUBCOMMANDS: readonly { name: string; summary: string }[] = [
  { name: "filters", summary: "List G'MIC's filters, or those matching a search" },
  { name: "filter", summary: "Run a filter by name, with Name=value settings" },
  { name: "script", summary: "Run a saved script by name, with Name=value settings" },
  { name: "scripts", summary: "List the saved scripts" },
  { name: "run", summary: "Run G'MIC words, even ones named like a subcommand" },
  { name: "help", summary: "G'MIC's own help for one of its commands" },
  { name: "status", summary: "Which gmic program runs, and its version" },
  { name: "update", summary: "Download G'MIC's latest filter definitions" },
];

export const USAGE: readonly string[] = [
  "gmic <G'MIC words…>",
  "gmic filters [search]",
  "gmic filter <name> [Name=value…]",
  "gmic script <name> [Name=value…]",
  "gmic scripts",
  "gmic help [command]",
  "gmic status",
  "gmic update",
];

const isAssignment = (w: string) => w.indexOf("=") > 0;

function nameThenAssignments(words: readonly string[]): { name: string; assignments: string[] } {
  const first = words.findIndex(isAssignment);
  const nameWords = first < 0 ? words : words.slice(0, first);
  return { name: nameWords.join(" ").trim(), assignments: first < 0 ? [] : words.slice(first) };
}

export function parseWords(words: readonly string[]): Action {
  if (words.length === 0) return { kind: "usage" };
  const [head, ...rest] = words;
  switch (head) {
    case "run":
      return rest.length === 0 ? { kind: "usage" } : { kind: "pipeline", line: gmicLine(rest) };
    case "filters":
      return { kind: "filters", search: rest.join(" ") };
    case "filter": {
      const { name, assignments } = nameThenAssignments(rest);
      if (!name) throw new Error("Name a filter: gmic filter <name> [Name=value…]. gmic filters lists them.");
      return { kind: "filter", name, assignments };
    }
    case "script": {
      if (rest[0] === "--source") {
        if (rest.length < 2) throw new Error("Give the script's text after --source.");
        return { kind: "script", name: null, source: rest[1], assignments: rest.slice(2) };
      }
      const { name, assignments } = nameThenAssignments(rest);
      if (!name) throw new Error("Name a script: gmic script <name>. gmic scripts lists them.");
      return { kind: "script", name, source: null, assignments };
    }
    case "scripts":
      return { kind: "scripts" };
    case "help":
      return { kind: "help", topic: rest.join(" ") };
    case "status":
      return { kind: "status" };
    case "update":
      return { kind: "update" };
    default:
      return { kind: "pipeline", line: gmicLine(words) };
  }
}
