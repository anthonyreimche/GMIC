// The interactive filters' editors' jobs against a real gmic (see
// real-gmic.test.ts): skipped unless GMIC_EXE names the program.

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEngine, type Programs } from "../src/gmic/engine";
import { gmicVars } from "../src/gmic/script";
import { colorizeJob, curvesJob, warpJob } from "../src/interactive/models";
import type { Planar } from "../src/gmic/cimg";
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
        let stderr = "";
        child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")));
        child.once("error", reject);
        const timer = setTimeout(() => child.kill(), 60_000);
        child.once("close", (code) => {
          clearTimeout(timer);
          const files: Record<string, Uint8Array> = {};
          for (const name of readdirSync(dir)) if ((options.outputs ?? []).includes(name)) files[name] = new Uint8Array(readFileSync(join(dir, name)));
          rmSync(dir, { recursive: true, force: true });
          resolve({ exitCode: code, killed: null, stdout: "", stderr, files });
        });
      }),
  };
}

/** A horizontal ramp on red, a vertical one on green, blue 128. */
function ramp(width: number, height: number): Planar {
  const plane = width * height;
  const data = new Float32Array(plane * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      data[i] = (x / (width - 1)) * 255;
      data[plane + i] = (y / (height - 1)) * 255;
      data[2 * plane + i] = 128;
    }
  return { width, height, channels: 3, data };
}

const at = (img: Planar, c: number, x: number, y: number) => img.data[c * img.width * img.height + y * img.width + x];

describe.skipIf(!EXE)("interactive editors' jobs on a real gmic", () => {
  const engine = createEngine(realPrograms(EXE));
  const run = (input: Planar, job: Parameters<typeof engine.runStack>[1][number]) =>
    engine.runStack(input, [job], { vars: gmicVars(input.width, input.height) });

  it("Curves: an inverted red curve inverts red only", async () => {
    const input = ramp(64, 32);
    const out = await run(input, curvesJob({ "Color Space": 0 }, { curves: [[0, 100, 100, 0]] }));
    expect(at(out, 0, 0, 5)).toBeGreaterThan(250);
    expect(at(out, 0, 63, 5)).toBeLessThan(5);
    expect(Math.abs(at(out, 1, 10, 20) - at(input, 1, 10, 20))).toBeLessThan(1);
  });

  it("Warp: no keypoints leaves the photo as it is; one moves what was at the centre to the right", async () => {
    const input = ramp(101, 51);
    const same = await run(input, warpJob(undefined));
    expect(Math.max(...same.data.map((v, i) => Math.abs(v - input.data[i])))).toBeLessThan(0.01);
    const moved = await run(input, warpJob({ points: [[60, 50, 50, 50]] }));
    expect(at(moved, 0, 60, 25)).toBeCloseTo(at(input, 0, 50, 25), -1);
  });

  it("Colorize: colour points colour a grey photo", async () => {
    const grey: Planar = { width: 64, height: 64, channels: 3, data: new Float32Array(64 * 64 * 3).fill(128) };
    const out = await run(grey, colorizeJob({ "Input Type": 0 }, { points: [[25, 25, 255, 0, 0], [75, 75, 0, 0, 255]] }));
    expect(at(out, 0, 10, 10)).toBeGreaterThan(at(out, 2, 10, 10) + 30);
    expect(at(out, 2, 54, 54)).toBeGreaterThan(at(out, 0, 54, 54) + 30);
  });
});
