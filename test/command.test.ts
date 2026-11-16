import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseFilterFile } from "../src/gmic/catalogue";
import { NotSetUpError, type GmicEngine } from "../src/gmic/engine";
import { gmicCommand, type CommandDeps } from "../src/command";
import type { Script } from "../src/scripts";
import type { CatalogPhoto, CommandRunContext } from "../src/safelight";

const catalogue = parseFilterFile(readFileSync(join(__dirname, "fixtures", "filters.gmic"), "utf8"));
const photo = (id: string, name: string) => ({ id, filename: name }) as unknown as CatalogPhoto;
const A = photo("a", "IMG_1.CR3");
const B = photo("b", "IMG_2.CR3");

function fakeEngine(overrides: Partial<GmicEngine> = {}): GmicEngine & { jobs: unknown[] } {
  const jobs: unknown[] = [];
  return {
    jobs,
    program: async () => ({ token: "t", path: "C:\\gmic\\gmic.exe", name: "gmic.exe" }),
    run: async (_input, job) => {
      jobs.push(job);
      return [new Uint8Array([1])];
    },
    catalogue: async () => catalogue,
    update: async () => catalogue,
    version: async () => "4.0.7",
    help: async (topic) => `help for ${topic}`,
    reset: () => {},
    ...overrides,
  };
}

function rig(words: string[], options: { photos?: CatalogPhoto[]; engine?: GmicEngine; scripts?: Script[]; caller?: "app" | "cli" } = {}) {
  const out: string[] = [];
  const warnings: string[] = [];
  const saved: { photo: string; suffix: string; ext: string }[] = [];
  let result: unknown;
  const ctx: CommandRunContext = {
    words,
    photos: options.photos ?? [A],
    caller: options.caller ?? "app",
    from: "terminal",
    signal: new AbortController().signal,
    print: (t) => void out.push(t),
    info: (t) => void out.push(`(info) ${t}`),
    warn: (t) => void warnings.push(t),
    progress: () => ({ update: () => {}, done: () => {} }),
    canSaveBeside: async () => null,
    saveBeside: async (p, _data, suffix, ext) => {
      saved.push({ photo: p.id, suffix, ext });
      return `${p.id}-${suffix}.${ext}`;
    },
    result: (v) => void (result = v),
  };
  const engine = options.engine ?? fakeEngine();
  const deps: CommandDeps = {
    engine,
    scripts: () => options.scripts ?? [],
    render: vi.fn(async () => new Uint8Array([0])),
    displayName: (p) => (p as unknown as { filename: string }).filename,
  };
  return { ctx, deps, out, warnings, saved, engine, result: () => result, run: () => gmicCommand(deps).run(ctx) };
}

describe("gmic command", () => {
  it("declares itself with its usage and subcommands", () => {
    const c = gmicCommand(rig([]).deps);
    expect(c.name).toBe("gmic");
    expect(c.subcommands?.map((s) => s.name)).toContain("filters");
    expect(c.usage[0]).toBe("gmic <G'MIC words…>");
  });

  it("prints its usage with no words", async () => {
    const r = rig([]);
    await r.run();
    expect(r.out[0]).toBe("gmic <G'MIC words…>");
  });

  it("runs G'MIC words on each photo and saves each result beside it", async () => {
    const r = rig(["-blur", "3"], { photos: [A, B] });
    await r.run();
    expect((r.engine as ReturnType<typeof fakeEngine>).jobs).toEqual([
      { kind: "line", line: "-blur 3" },
      { kind: "line", line: "-blur 3" },
    ]);
    expect(r.saved).toEqual([
      { photo: "a", suffix: "gmic", ext: "png" },
      { photo: "b", suffix: "gmic", ext: "png" },
    ]);
    expect(r.result()).toEqual({ saved: ["a-gmic.png", "b-gmic.png"], failed: [] });
  });

  it("runs a filter by name with its settings", async () => {
    const r = rig(["filter", "Sharpen", "[Unsharp", "Mask]", "radius=3"]);
    await r.run();
    expect((r.engine as ReturnType<typeof fakeEngine>).jobs).toEqual([{ kind: "line", line: "fx_unsharp 1,3,1,0" }]);
  });

  it("runs a saved script, its #@gui parameters set by name", async () => {
    const scripts: Script[] = [{ id: "s1", name: "Soft Glow", source: "#@gui : Strength = float(0.5,0,1)\nblur $1" }];
    const r = rig(["script", "soft", "glow", "strength=0.8"], { scripts });
    await r.run();
    expect((r.engine as ReturnType<typeof fakeEngine>).jobs).toEqual([{ kind: "script", source: scripts[0].source, args: "0.8" }]);
  });

  it("names an unknown filter or script", async () => {
    await expect(rig(["filter", "Nope"]).run()).rejects.toThrow(/No filter "Nope"/);
    await expect(rig(["script", "Nope"]).run()).rejects.toThrow(/No script "Nope"/);
  });

  it("lists filters matching a search", async () => {
    const r = rig(["filters", "unsharp"]);
    await r.run();
    expect(r.out).toEqual(["Details › Sharpen [Unsharp Mask]   fx_unsharp"]);
    expect(r.result()).toEqual([{ category: "Details", name: "Sharpen [Unsharp Mask]", command: "fx_unsharp" }]);
  });

  it("says when no filter matches", async () => {
    const r = rig(["filters", "zzz"]);
    await r.run();
    expect(r.out).toEqual(['(info) No filter matches "zzz".']);
  });

  it("lists saved scripts with their parameters", async () => {
    const scripts: Script[] = [
      { id: "s1", name: "Soft Glow", source: "#@gui : Strength = float(0.5,0,1)\nblur $1" },
      { id: "s2", name: "Mono", source: "luminance" },
    ];
    const r = rig(["scripts"], { scripts });
    await r.run();
    expect(r.out).toEqual(["Soft Glow   Strength", "Mono"]);
  });

  it("shows the status, help and update", async () => {
    const r = rig(["status"]);
    await r.run();
    expect(r.out).toEqual(["G'MIC 4.0.7: C:\\gmic\\gmic.exe"]);
    const h = rig(["help", "blur"]);
    await h.run();
    expect(h.out).toEqual(["help for blur"]);
    const u = rig(["update"]);
    await u.run();
    expect(u.out).toEqual(["G'MIC's filters are up to date: 5 filters."]);
  });

  it("refuses to run with no photos, in words for where it runs", async () => {
    await expect(rig(["blur", "3"], { photos: [] }).run()).rejects.toThrow(/select some in the Library/);
    await expect(rig(["blur", "3"], { photos: [], caller: "cli" }).run()).rejects.toThrow(/after --/);
  });

  it("checks every photo can take a result before running anything", async () => {
    const r = rig(["blur", "3"], { photos: [A, B] });
    r.ctx.canSaveBeside = async (p) => (p.id === "b" ? "This folder is read-only." : null);
    await expect(r.run()).rejects.toThrow(/IMG_2.CR3: This folder is read-only/);
    expect(r.deps.render).not.toHaveBeenCalled();
  });

  it("checks G'MIC is set up before rendering", async () => {
    const r = rig(["blur", "3"], { engine: fakeEngine({ program: async () => null }) });
    await expect(r.run()).rejects.toBeInstanceOf(NotSetUpError);
    expect(r.deps.render).not.toHaveBeenCalled();
  });

  it("goes on past a photo that fails, and fails when every photo does", async () => {
    let n = 0;
    const flaky = fakeEngine({
      run: async () => {
        if (n++ === 0) throw new Error("G'MIC: *** Error *** boom");
        return [new Uint8Array([1])];
      },
    });
    const r = rig(["blur", "3"], { photos: [A, B], engine: flaky });
    await r.run();
    expect(r.warnings).toEqual(["IMG_1.CR3: G'MIC: *** Error *** boom"]);
    expect(r.saved.map((s) => s.photo)).toEqual(["b"]);

    const broken = fakeEngine({ run: async () => Promise.reject(new Error("G'MIC: *** Error *** boom")) });
    await expect(rig(["blur", "3"], { engine: broken }).run()).rejects.toThrow(/boom/);
  });

  it("stops at once when cancelled", async () => {
    const controller = new AbortController();
    const engine = fakeEngine({
      run: async () => {
        controller.abort();
        throw new DOMException("Stopped.", "AbortError");
      },
    });
    const r = rig(["blur", "3"], { photos: [A, B], engine });
    r.ctx.signal = controller.signal;
    await expect(r.run()).rejects.toThrow(/Stopped/);
    expect(r.saved).toEqual([]);
  });
});
