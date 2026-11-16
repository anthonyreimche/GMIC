// What G'MIC runs. Every job is written into a command file loaded with `-m`,
// so the pipeline, a filter's arguments and a script's text never pass through
// gmic's own argument quoting. The photo comes in as a 16-bit PNG: it is
// scaled to G'MIC's 0–255 range, the job runs, and each image it leaves is
// clipped and scaled back for a 16-bit write.

import { guiLines, guiParams } from "./gui";
import type { Param } from "./params";

export const RUN = "_safelight_run";
export const ENTRY = "_safelight_job";

export type Job =
  /** A G'MIC command line: a pipeline, or a filter with its arguments. */
  | { kind: "line"; line: string }
  /** A script's source, and the argument list its parameters make. */
  | { kind: "script"; source: string; args: string };

const DEFINITION = /^[A-Za-z_][A-Za-z0-9_]*\s*:/m;

/** Whether `source` defines commands (a name and a colon at the start of a
 *  line), so it is a command file with `main` as its entry. */
export function definesCommands(source: string): boolean {
  return DEFINITION.test(source);
}

const call = (name: string, args: string) => (args ? `${name} ${args}` : name);
const indent = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => (l.trim() === "" ? "" : `  ${l}`))
    .join("\n");

function runCommandFor(entry: string, inputBits: 8 | 16): string {
  const scale = inputBits === 16 ? ["  div 257"] : [];
  return [`${RUN} :`, ...scale, `  ${entry}`, "  foreach { cut 0,255 mul 257 }", ""].join("\n");
}

/** The command file for `job` on an input PNG of `inputBits` bits. */
export function commandFile(job: Job, inputBits: 8 | 16 = 16): string {
  const runCommand = (entry: string) => runCommandFor(entry, inputBits);
  if (job.kind === "line") return `${runCommand(ENTRY)}\n${ENTRY} :\n${indent(job.line)}\n`;
  if (definesCommands(job.source)) {
    if (!/^main\s*:/m.test(job.source)) {
      throw new Error("This script defines commands, so it needs one called main: that's where it starts.");
    }
    return `${runCommand(call("main", job.args))}\n${job.source}\n`;
  }
  const body = `${ENTRY}_body`;
  return `${runCommand(call(body, job.args))}\n${body} :\n${indent(job.source)}\n`;
}

export const CATALOGUE = "_safelight_catalogue";

/** The command file that writes G'MIC's filter definitions, as its `update`
 *  downloads them, to filters.gmic: the file G'MIC-Qt reads its filters from.
 *  It writes nothing until that update has run once. */
export function catalogueFile(): string {
  return [
    `${CATALOGUE} :`,
    "  l[] { i cimgz:${_path_rc}update$_version.gmic onfail l[] { it ${_path_rc}update$_version.gmic onfail } }",
    "  if $! o[-1] raw:filters.gmic,uint8 fi",
    "",
  ].join("\n");
}

/** The command line that runs a command file on input.png and writes out.png
 *  (out_000000.png and on, when the job leaves several images). */
export function runArgs(): string[] {
  return ["-v", "0", "-m", "job.gmic", "input.png", RUN, "-o", "out.png,16"];
}

/** A script's settings, from `#@gui : Name = type(arguments)` lines written
 *  the way G'MIC-Qt reads them. Kinds it can't show are left out. */
export function scriptParams(source: string): Param[] {
  return guiParams(guiLines(source));
}
