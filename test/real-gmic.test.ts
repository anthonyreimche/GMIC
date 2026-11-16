// The engine against a real gmic program, through a stand-in for core's
// api.programs runner: a fresh folder, the files written, no shell, the named
// outputs read back. Skipped unless GMIC_EXE names the program:
//   GMIC_EXE=C:\path\to\gmic.exe npx vitest run test/real-gmic.test.ts
// Downloading the filter list (gmic update) needs the internet once.

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findFilter } from "../src/gmic/catalogue";
import { NeedsUpdateError, createEngine, pngBitDepth, type Programs } from "../src/gmic/engine";
import { defaultsOf } from "../src/gmic/params";
import { filterJob, scriptJob } from "../src/jobs";
import type { ProgramRunOptions, ProgramRunResult } from "../src/safelight";

const EXE = process.env.GMIC_EXE ?? "";

function realPrograms(exe: string): Programs {
  return {
    list: async () => [{ token: "real", path: exe, name: "gmic" }],
    run: (_token, args, options: ProgramRunOptions = {}) =>
      new Promise<ProgramRunResult>((resolve, reject) => {
        const dir = mkdtempSync(join(tmpdir(), "gmic-test-"));
        for (const [name, bytes] of Object.entries(options.files ?? {})) writeFileSync(join(dir, name), bytes);
        const child = spawn(exe, args, { cwd: dir, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (c: Buffer) => (stdout += c.toString("utf8")));
        child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")));
        child.once("error", reject);
        child.once("close", (code) => {
          const files: Record<string, Uint8Array> = {};
          for (const name of readdirSync(dir)) {
            const wanted = (options.outputs ?? []).some((o) => (o.endsWith("*") ? name.startsWith(o.slice(0, -1)) : name === o));
            if (wanted) files[name] = new Uint8Array(readFileSync(join(dir, name)));
          }
          rmSync(dir, { recursive: true, force: true });
          resolve({ exitCode: code, killed: null, stdout, stderr, files });
        });
      }),
  };
}

/** A test photo as Safelight renders one: a PNG, made by gmic itself. */
async function photo(programs: Programs, bits: 8 | 16): Promise<Uint8Array> {
  const scale = bits === 16 ? ["mul", "257"] : [];
  const r = await programs.run("real", ["-v", "0", "sp", "lena,256", ...scale, "o", `p.png,${bits}`], { outputs: ["p.png"] });
  const png = r.files["p.png"];
  if (!png) throw new Error(`gmic made no test photo: ${r.stderr}`);
  return png;
}

/** The mean of a PNG's values on 0–255, worked out by gmic. */
async function mean(programs: Programs, png: Uint8Array): Promise<number> {
  const r = await programs.run("real", ["-v", "0", "a.png", "div", "257", "e", "{ia}"], { files: { "a.png": png } });
  const value = Number(r.stderr.trim());
  if (!Number.isFinite(value) || r.stderr.trim() === "") throw new Error(`gmic gave no mean: ${r.stderr}`);
  return value;
}

describe.skipIf(!EXE)("a real gmic", { timeout: 300_000 }, () => {
  const programs = realPrograms(EXE);
  const engine = createEngine(programs);

  it("reads its version", async () => {
    expect(await engine.version()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("reads the filter list, downloading G'MIC's update first when it has none", async () => {
    let catalogue;
    try {
      catalogue = await engine.catalogue();
    } catch (e) {
      if (!(e instanceof NeedsUpdateError)) throw e;
      catalogue = await engine.update();
    }
    const count = catalogue.categories.reduce((n, c) => n + c.filters.length, 0);
    expect(count).toBeGreaterThan(1000);
    const empty = catalogue.categories.flatMap((c) => c.filters).filter((f) => f.params.length === 0);
    expect(empty.length / count).toBeLessThan(0.1);
    expect(catalogue.categories.some((c) => c.name.startsWith("Testing › "))).toBe(true);
    const unsharp = findFilter(catalogue, "fx_unsharp");
    expect(unsharp?.params.some((p) => p.kind === "float")).toBe(true);
  });

  it("runs a pipeline on a 16-bit photo and gives back a 16-bit photo of the same brightness", async () => {
    const input = await photo(programs, 16);
    expect(pngBitDepth(input)).toBe(16);
    const [out] = await engine.run(input, { kind: "line", line: "blur 2" });
    expect(pngBitDepth(out)).toBe(16);
    expect(Math.abs((await mean(programs, out)) - (await mean(programs, input)))).toBeLessThan(2);
  });

  it("scales an 8-bit photo up to 16 bits without darkening it", async () => {
    const input = await photo(programs, 8);
    const [out] = await engine.run(input, { kind: "line", line: "blur 1" });
    expect(pngBitDepth(out)).toBe(16);
    expect(await mean(programs, out)).toBeGreaterThan(50);
  });

  it("runs a GUI filter with its default settings", async () => {
    const catalogue = await engine.catalogue();
    const unsharp = findFilter(catalogue, "fx_unsharp")!;
    const [out] = await engine.run(await photo(programs, 16), filterJob(unsharp, defaultsOf(unsharp.params)));
    expect(pngBitDepth(out)).toBe(16);
  });

  it("runs a script with #@gui settings, and one that defines main", async () => {
    const input = await photo(programs, 16);
    const flat = "#@gui : Radius = float(3,0,20)\nblur $1\nsharpen 20";
    expect(await engine.run(input, scriptJob(flat, { Radius: 4 }))).toHaveLength(1);
    const defined = "#@gui : Gain = float(1.1,0,2)\nmain :\n  my_gain $1\n\nmy_gain :\n  mul $1";
    const [out] = await engine.run(input, scriptJob(defined, { Gain: 0.5 }));
    expect(await mean(programs, out)).toBeLessThan((await mean(programs, input)) * 0.6);
  });

  it("saves every image a job leaves", async () => {
    const out = await engine.run(await photo(programs, 16), { kind: "line", line: "+mirror x" });
    expect(out).toHaveLength(2);
  });

  it("fails with G'MIC's own message", async () => {
    await expect(engine.run(await photo(programs, 16), { kind: "line", line: "blurr 3" })).rejects.toThrow(/blurr/);
  });

  it("reads a command's help", async () => {
    expect((await engine.help("blur")).toLowerCase()).toContain("blur");
  });
});
