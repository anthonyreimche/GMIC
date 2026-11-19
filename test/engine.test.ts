import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { NeedsUpdateError, NotSetUpError, createEngine, gmicError, pngBitDepth, type Programs } from "../src/gmic/engine";
import type { KeptProgram, ProgramRunOptions, ProgramRunResult } from "../src/safelight";
import { decodeCimg, encodeCimg } from "../src/gmic/cimg";
import { stackArgs } from "../src/gmic/script";

const PROGRAM: KeptProgram = { token: "t1", path: "C:\\gmic\\gmic.exe", name: "gmic.exe" };
const fixture = readFileSync(join(__dirname, "fixtures", "filters.gmic"), "utf8");
const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

/** A PNG header with the given bit depth: signature, then the IHDR chunk. */
function png(bits: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82], 0);
  b[24] = bits;
  return b;
}

type Call = { token: string; args: string[]; options: ProgramRunOptions };

function fakePrograms(answer: (call: Call) => Partial<ProgramRunResult>, kept: KeptProgram[] = [PROGRAM]) {
  const calls: Call[] = [];
  const programs: Programs = {
    list: async () => kept,
    run: async (token, args, options = {}) => {
      const call = { token, args, options };
      calls.push(call);
      return { exitCode: 0, killed: null, stdout: "", stderr: "", files: {}, ...answer(call) };
    },
  };
  return { programs, calls };
}

describe("pngBitDepth", () => {
  it("reads the bit depth from the IHDR chunk", () => {
    expect(pngBitDepth(png(16))).toBe(16);
    expect(pngBitDepth(png(8))).toBe(8);
  });

  it("refuses bytes that aren't a PNG", () => {
    expect(() => pngBitDepth(enc("GIF89a............................"))).toThrow(/PNG/);
  });
});

describe("gmicError", () => {
  it("keeps G'MIC's own error lines, without terminal colours", () => {
    const stderr = "[gmic]./ Start G'MIC interpreter.\n\u001b[31m[gmic] *** Error in ./_safelight_job/ *** Unknown command 'blurr'.\u001b[0m\n";
    expect(gmicError({ exitCode: 1, killed: null, stdout: "", stderr, files: {} })).toBe(
      "G'MIC: *** Error in ./_safelight_job/ *** Unknown command 'blurr'.",
    );
  });

  it("says when the run was stopped", () => {
    expect(gmicError({ exitCode: null, killed: "timeout", stdout: "", stderr: "", files: {} })).toMatch(/took too long/);
  });
});

describe("createEngine", () => {
  it("runs a job from a command file on the input, and returns its images in order", async () => {
    const { programs, calls } = fakePrograms(() => ({
      files: { "out_000001.png": enc("b"), "out_000000.png": enc("a") },
    }));
    const engine = createEngine(programs);
    const out = await engine.run(png(16), { kind: "line", line: "blur 3" });
    expect(out.map(dec)).toEqual(["a", "b"]);
    const [call] = calls;
    expect(call.token).toBe("t1");
    expect(call.args).toEqual(["-v", "0", "-m", "job.gmic", "input.png", "_safelight_run", "-o", "out.png,16"]);
    expect(Object.keys(call.options.files ?? {}).sort()).toEqual(["input.png", "job.gmic"]);
    expect(dec(call.options.files!["job.gmic"])).toContain("div 257");
    expect(call.options.outputs).toEqual(["out.png", "out_*"]);
  });

  it("scales only 16-bit input", async () => {
    const { programs, calls } = fakePrograms(() => ({ files: { "out.png": enc("x") } }));
    await createEngine(programs).run(png(8), { kind: "line", line: "blur 3" });
    expect(dec(calls[0].options.files!["job.gmic"])).not.toContain("div 257");
  });

  it("passes the signal and the output callback through", async () => {
    const { programs, calls } = fakePrograms(() => ({ files: { "out.png": enc("x") } }));
    const signal = new AbortController().signal;
    const onOutput = vi.fn();
    await createEngine(programs).run(png(16), { kind: "line", line: "blur 3" }, { signal, onOutput });
    expect(calls[0].options.signal).toBe(signal);
    expect(calls[0].options.onOutput).toBe(onOutput);
  });

  it("fails with G'MIC's message when it fails or writes nothing", async () => {
    const failing = fakePrograms(() => ({ exitCode: 1, stderr: "[gmic] *** Error *** Unknown command 'x'." }));
    await expect(createEngine(failing.programs).run(png(16), { kind: "line", line: "x" })).rejects.toThrow(/Unknown command 'x'/);
    const empty = fakePrograms(() => ({}));
    await expect(createEngine(empty.programs).run(png(16), { kind: "line", line: "rm" })).rejects.toThrow(/no image/);
  });

  it("says G'MIC isn't set up when no program is kept", async () => {
    const { programs } = fakePrograms(() => ({}), []);
    await expect(createEngine(programs).run(png(16), { kind: "line", line: "blur 3" })).rejects.toBeInstanceOf(NotSetUpError);
  });

  it("reads the filter list once per program", async () => {
    const { programs, calls } = fakePrograms(() => ({ files: { "filters.gmic": enc(fixture) } }));
    const engine = createEngine(programs);
    const catalogue = await engine.catalogue();
    await engine.catalogue();
    expect(catalogue.categories.map((c) => c.name)).toEqual(["Details", "Artistic", "Artistic › Frames", "Corvo"]);
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toEqual(["-v", "0", "-m", "catalogue.gmic", "_safelight_catalogue"]);
    expect(calls[0].options.outputs).toEqual(["filters.gmic"]);
  });

  it("asks for G'MIC's update when it has no filter definitions yet", async () => {
    const { programs } = fakePrograms(() => ({}));
    await expect(createEngine(programs).catalogue()).rejects.toBeInstanceOf(NeedsUpdateError);
  });

  it("updates, then reads the list again", async () => {
    let updated = false;
    const { programs, calls } = fakePrograms((call) => {
      if (call.args.includes("update")) {
        updated = true;
        return {};
      }
      return updated ? { files: { "filters.gmic": enc(fixture) } } : {};
    });
    const engine = createEngine(programs);
    await expect(engine.catalogue()).rejects.toBeInstanceOf(NeedsUpdateError);
    const catalogue = await engine.update();
    expect(calls[1].args).toEqual(["-v", "0", "update"]);
    expect(catalogue.categories).toHaveLength(4);
  });

  it("reads the version and a command's help", async () => {
    const { programs } = fakePrograms((call) =>
      call.args[0] === "version"
        ? { stdout: "\n  G'MIC-4.0.7\n  GREYC's Magic for Image Computing\n" }
        : { stdout: "\u001b[1m  blur:\u001b[0m\n    Blur selected images.\n" },
    );
    const engine = createEngine(programs);
    expect(await engine.version()).toBe("4.0.7");
    expect(await engine.help("blur")).toBe("  blur:\n    Blur selected images.");
  });
});

describe("runStack", () => {
  it("sends the image as a float CImg with the stack's command file, and reads back the first result", async () => {
    const out = encodeCimg({ width: 1, height: 1, channels: 3, data: new Float32Array([255, 0, 127.5]) });
    const { programs, calls } = fakePrograms(() => ({ files: { "out.cimg": out } }));
    const engine = createEngine(programs);
    const input = { width: 1, height: 1, channels: 3, data: new Float32Array([1, 2, 3]) };
    const result = await engine.runStack(input, [{ kind: "line", line: "blur 1" }], { vars: { _host: "safelight" } });
    expect(calls[0].args).toEqual(stackArgs());
    expect(calls[0].options.outputs).toEqual(["out.cimg"]);
    expect(decodeCimg(calls[0].options.files!["input.cimg"])[0]).toEqual(input);
    const file = dec(calls[0].options.files!["job.gmic"]);
    expect(file).toContain("_host=safelight");
    expect(file).toContain("_sl_step_1 :\n  blur 1");
    expect(result).toEqual({ width: 1, height: 1, channels: 3, data: new Float32Array([255, 0, 127.5]) });
  });

  it("says so when G'MIC leaves nothing", async () => {
    const { programs } = fakePrograms(() => ({}));
    const input = { width: 1, height: 1, channels: 3, data: new Float32Array(3) };
    await expect(createEngine(programs).runStack(input, [{ kind: "line", line: "rm" }])).rejects.toThrow(/no image/);
  });

  it("passes the signal on, and a cancelled run rejects as an abort", async () => {
    const { programs, calls } = fakePrograms(() => ({ killed: "cancelled", exitCode: null }));
    const signal = new AbortController().signal;
    const input = { width: 1, height: 1, channels: 3, data: new Float32Array(3) };
    await expect(createEngine(programs).runStack(input, [{ kind: "line", line: "blur 1" }], { signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(calls[0].options.signal).toBe(signal);
  });
});
