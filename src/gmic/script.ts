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

export const STACK_RUN = "_safelight_stack";

const MAIN = /^main(\s*:)/m;

/** The command file that runs a photo's stack on input.cimg, a float image
 *  on G'MIC's 0–255 scale: each job in turn, keeping the first image between
 *  them, and `vars` set first (the ones G'MIC-Qt sets for its filters). */
export function stackFile(jobs: readonly Job[], vars: Readonly<Record<string, string | number>> = {}): string {
  const calls: string[] = [];
  const definitions: string[] = [];
  jobs.forEach((raw, i) => {
    const job: Job = raw.kind === "script" ? { ...raw, source: raw.source.replace(/\r\n?/g, "\n") } : raw;
    const step = `_sl_step_${i + 1}`;
    if (job.kind === "line") {
      calls.push(step);
      definitions.push(`${step} :\n${indent(job.line)}\n`);
    } else if (definesCommands(job.source)) {
      if (!MAIN.test(job.source)) throw new Error("A script that defines commands needs one called main: that's where it starts.");
      const main = `_sl_main_${i + 1}`;
      calls.push(call(main, job.args));
      definitions.push(`${job.source.replace(MAIN, `${main}$1`).replace(/\s*$/, "")}\n`);
    } else {
      calls.push(call(step, job.args));
      definitions.push(`${step} :\n${indent(job.source)}\n`);
    }
  });
  const sets = Object.entries(vars).map(([name, value]) => `  ${name}=${value}`);
  const run = [`${STACK_RUN} :`, ...sets, ...calls.flatMap((c) => [`  ${c}`, "  k[0]"]), "  cut 0,255", ""].join("\n");
  return [run, ...definitions].join("\n");
}

/** The command line that runs a stack's command file on input.cimg. */
export function stackArgs(): string[] {
  return ["-v", "0", "-m", "job.gmic", "input.cimg", STACK_RUN, "-o", "out.cimg,float32"];
}

/** The variables G'MIC-Qt sets for a filter run on a `width × height` image
 *  (layer, output and preview geometry), which G'MIC's filters read. A
 *  preview also has its area's size and the preview switch on. */
export function gmicVars(width: number, height: number, preview = false): Record<string, string | number> {
  const vars: Record<string, string | number> = {
    _host: "safelight",
    _input_layers: 1,
    _output_mode: 0,
    _output_messages: 0,
    _preview_x0: 0,
    _preview_y0: 0,
    _preview_x1: width - 1,
    _preview_y1: height - 1,
    _preview_width: width,
    _preview_height: height,
  };
  if (preview) Object.assign(vars, { _preview_area_width: width, _preview_area_height: height, _preview_enabled: 1 });
  return vars;
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
