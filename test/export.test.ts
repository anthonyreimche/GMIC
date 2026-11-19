import { describe, expect, it } from "vitest";
import { exportProcessor, type ExportDeps } from "../src/export";
import type { Planar } from "../src/gmic/cimg";
import type { Job } from "../src/gmic/script";
import type { Catalogue } from "../src/gmic/catalogue";
import type { CatalogPhoto, EditState, ExportFrame, ExportProcessorContext } from "../src/safelight";
import type { Item } from "../src/stack";

const PHOTO = { id: "p1" } as CatalogPhoto;
const CONTEXT = { longEdge: null, settings: {} } as unknown as ExportProcessorContext;
const catalogue: Catalogue = {
  version: "4.0.7",
  categories: [{ name: "D", filters: [{ name: "Blur", category: "D", command: "fx_blur", previewScale: "any", params: [{ kind: "float", name: "R", pos: 1, default: 1, min: 0, max: 9 }] }] }],
};

function frame(width = 2, height = 1): ExportFrame {
  return { data: new Uint16Array(width * height * 4).fill(65535), width, height, colorSpace: "srgb", icc: null, bitDepth: 16 };
}

function edit(bags: Record<string, unknown>[], currentIndex = bags.length - 1): EditState {
  return { photoId: "p1", currentIndex, stack: bags.map((paramBag) => ({ timestamp: 0, label: "", params: {} as EditState["stack"][0]["params"], paramBag })) };
}

function deps(over: Partial<ExportDeps> & { items?: Item[] } = {}) {
  const runs: { input: Planar; jobs: readonly Job[]; vars?: Readonly<Record<string, string | number>> }[] = [];
  let catalogues = 0;
  const d: ExportDeps = {
    installed: () => over.items ?? [{ id: "a", kind: "filter", name: "Blur", command: "fx_blur" }],
    editState: async () => edit([{}, { "gmic.f.a": { on: true, values: { R: 3 } } }]),
    catalogue: async () => {
      catalogues++;
      return catalogue;
    },
    runStack: async (input, jobs, options) => {
      runs.push({ input, jobs, vars: options?.vars });
      return { width: input.width, height: input.height, channels: 3, data: new Float32Array(input.data.length).fill(127.5) };
    },
    ...over,
  };
  return { d, runs, catalogues: () => catalogues };
}

describe("the export processor", () => {
  it("is labelled G'MIC and can be switched off for an export", () => {
    const p = exportProcessor(deps().d);
    expect(p.label).toBe("G'MIC");
    expect(p.settings).toEqual([expect.objectContaining({ key: "enabled", type: "boolean", default: true })]);
  });

  it("runs the photo's switched-on items at the edit's cursor on the exported pixels", async () => {
    const { d, runs } = deps();
    const out = (await exportProcessor(d).processPixels!(frame(), PHOTO, { enabled: true }, CONTEXT)) as ExportFrame;
    expect(runs).toHaveLength(1);
    expect(runs[0].jobs).toEqual([{ kind: "line", line: "fx_blur 3" }]);
    expect([...runs[0].input.data]).toEqual([255, 255, 255, 255, 255, 255]);
    expect(runs[0].vars).toMatchObject({ _preview_width: 2, _preview_height: 1 });
    expect(out.width).toBe(2);
    expect([...out.data.slice(0, 4)]).toEqual([32768, 32768, 32768, 65535]);
  });

  it("follows the cursor, so an undone step isn't exported", async () => {
    const { d, runs } = deps({ editState: async () => edit([{}, { "gmic.f.a": { on: true, values: {} } }], 0) });
    expect(await exportProcessor(d).processPixels!(frame(), PHOTO, { enabled: true }, CONTEXT)).toBeUndefined();
    expect(runs).toHaveLength(0);
  });

  it("leaves the pixels alone when switched off, with nothing switched on, or with no edit", async () => {
    const off = deps();
    expect(await exportProcessor(off.d).processPixels!(frame(), PHOTO, { enabled: false }, CONTEXT)).toBeUndefined();
    const none = deps({ editState: async () => null });
    expect(await exportProcessor(none.d).processPixels!(frame(), PHOTO, { enabled: true }, CONTEXT)).toBeUndefined();
    expect(off.runs.length + none.runs.length).toBe(0);
  });

  it("reads the filter list only when a filter runs", async () => {
    const { d, catalogues } = deps({
      items: [{ id: "s", kind: "script", name: "S", source: "blur 1" }],
      editState: async () => edit([{ "gmic.f.s": { on: true, values: {} } }]),
    });
    await exportProcessor(d).processPixels!(frame(), PHOTO, { enabled: true }, CONTEXT);
    expect(catalogues()).toBe(0);
  });

  it("returns a result G'MIC resized at its new size", async () => {
    const { d } = deps({
      runStack: async () => ({ width: 3, height: 3, channels: 1, data: new Float32Array(9).fill(255) }),
    });
    const out = (await exportProcessor(d).processPixels!(frame(), PHOTO, { enabled: true }, CONTEXT)) as ExportFrame;
    expect([out.width, out.height, out.data.length]).toEqual([3, 3, 36]);
    expect(out.data[0]).toBe(65535);
  });

  it("fails the photo with G'MIC's message rather than export it without its look", async () => {
    const { d } = deps({ runStack: async () => Promise.reject(new Error("G'MIC: *** boom")) });
    await expect(exportProcessor(d).processPixels!(frame(), PHOTO, { enabled: true }, CONTEXT)).rejects.toThrow("G'MIC: *** boom");
  });
});
