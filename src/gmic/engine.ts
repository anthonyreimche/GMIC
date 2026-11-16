// The gmic program, through api.programs: runs a job on a photo's pixels and
// reads G'MIC's filter definitions, version and help. The program is the one the
// person chose for this extension (the first one kept).

import { parseFilterFile, type Catalogue } from "./catalogue";
import { CATALOGUE, catalogueFile, commandFile, runArgs, type Job } from "./script";
import type { KeptProgram, ProgramRunOptions, ProgramRunResult, ProgramsAPI } from "../safelight";

export type Programs = Pick<ProgramsAPI, "list" | "run">;

export class NotSetUpError extends Error {
  constructor() {
    super("G'MIC isn't set up. Open the G'MIC panel and choose Find G'MIC.");
    this.name = "NotSetUpError";
  }
}

export class NeedsUpdateError extends Error {
  constructor() {
    super("G'MIC has no filter list yet: it comes with G'MIC's update. Run gmic update, or choose Download filters in the G'MIC panel.");
    this.name = "NeedsUpdateError";
  }
}

export interface RunOptions {
  signal?: AbortSignal;
  onOutput?: ProgramRunOptions["onOutput"];
}

export interface GmicEngine {
  program(): Promise<KeptProgram | null>;
  /** Runs `job` on a PNG and returns the PNGs it leaves, in order. */
  run(input: Uint8Array, job: Job, options?: RunOptions): Promise<Uint8Array[]>;
  catalogue(options?: RunOptions): Promise<Catalogue>;
  /** Downloads G'MIC's latest filter definitions, then reads the list again. */
  update(options?: RunOptions): Promise<Catalogue>;
  version(): Promise<string>;
  help(topic: string): Promise<string>;
  /** Forget the cached filter list (after the program changes). */
  reset(): void;
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const RUN_TIMEOUT_MS = 60 * 60 * 1000;
const QUICK_TIMEOUT_MS = 5 * 60 * 1000;

export function pngBitDepth(bytes: Uint8Array): number {
  const isPng = bytes.length > 24 && PNG_SIGNATURE.every((b, i) => bytes[i] === b);
  if (!isPng) throw new Error("Safelight's render isn't a PNG.");
  return bytes[24];
}

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const clean = (text: string) => text.replace(ANSI, "").replace(/\r/g, "");

/** What went wrong in a run, in G'MIC's own words where it gave some. */
export function gmicError(result: ProgramRunResult): string {
  if (result.killed === "timeout") return "G'MIC took too long and was stopped.";
  if (result.killed === "cancelled") return "Stopped.";
  const lines = clean(result.stderr)
    .split("\n")
    .map((l) => l.replace(/^\s*\[gmic\]\s?/, "").trim())
    .filter(Boolean);
  const errors = lines.filter((l) => l.includes("***"));
  const shown = errors.length > 0 ? errors : lines.slice(-6);
  if (shown.length > 0) return `G'MIC: ${shown.join("\n")}`;
  return `G'MIC stopped with exit code ${result.exitCode ?? "unknown"}.`;
}

const utf8 = (text: string) => new TextEncoder().encode(text);

/** out.png, or out_000000.png and on, in order. */
function images(files: Record<string, Uint8Array>): Uint8Array[] {
  return Object.keys(files)
    .filter((name) => /^out(_\d+)?\.png$/.test(name))
    .sort()
    .map((name) => files[name]);
}

export function createEngine(programs: Programs): GmicEngine {
  let cached: { token: string; catalogue: Promise<Catalogue> } | null = null;

  async function program(): Promise<KeptProgram | null> {
    const [first] = await programs.list();
    return first ?? null;
  }

  async function token(): Promise<string> {
    const p = await program();
    if (!p) throw new NotSetUpError();
    return p.token;
  }

  async function exec(args: string[], options: ProgramRunOptions): Promise<ProgramRunResult> {
    const result = await programs.run(await token(), args, options);
    if (result.killed === "cancelled") throw new DOMException("Stopped.", "AbortError");
    if (result.exitCode !== 0 || result.killed) throw new Error(gmicError(result));
    return result;
  }

  async function readCatalogue(options: RunOptions): Promise<Catalogue> {
    const result = await exec(["-v", "0", "-m", "catalogue.gmic", CATALOGUE], {
      files: { "catalogue.gmic": utf8(catalogueFile()) },
      outputs: ["filters.gmic"],
      timeoutMs: QUICK_TIMEOUT_MS,
      signal: options.signal,
    });
    const file = result.files["filters.gmic"];
    const catalogue = file ? parseFilterFile(new TextDecoder().decode(file)) : null;
    if (!catalogue || catalogue.categories.length === 0) throw new NeedsUpdateError();
    return catalogue;
  }

  async function catalogue(options: RunOptions = {}): Promise<Catalogue> {
    const current = await token();
    if (cached?.token !== current) {
      const pending = readCatalogue(options);
      cached = { token: current, catalogue: pending };
      pending.catch(() => {
        if (cached?.catalogue === pending) cached = null;
      });
    }
    return cached.catalogue;
  }

  return {
    program,
    async run(input, job, options = {}) {
      const bits = pngBitDepth(input) === 16 ? 16 : 8;
      const result = await exec(runArgs(), {
        files: { "input.png": input, "job.gmic": utf8(commandFile(job, bits)) },
        outputs: ["out.png", "out_*"],
        timeoutMs: RUN_TIMEOUT_MS,
        signal: options.signal,
        onOutput: options.onOutput,
      });
      const out = images(result.files);
      if (out.length === 0) throw new Error("G'MIC left no image to save.");
      return out;
    },
    catalogue,
    async update(options = {}) {
      await exec(["-v", "0", "update"], { timeoutMs: QUICK_TIMEOUT_MS, signal: options.signal, onOutput: options.onOutput });
      cached = null;
      return catalogue(options);
    },
    async version() {
      const result = await exec(["version"], { timeoutMs: QUICK_TIMEOUT_MS });
      return /(\d+\.\d+\.\d+)/.exec(clean(result.stdout + result.stderr))?.[1] ?? "unknown";
    },
    async help(topic) {
      const result = await exec(["help", topic], { timeoutMs: QUICK_TIMEOUT_MS });
      return clean(result.stdout || result.stderr).replace(/^\n+|\s+$/g, "");
    },
    reset() {
      cached = null;
    },
  };
}
