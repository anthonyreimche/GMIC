import { describe, expect, it } from "vitest";
import { stepJobs, stepParams } from "../src/jobs";
import type { Catalogue } from "../src/gmic/catalogue";
import type { Step } from "../src/stack";

const catalogue: Catalogue = {
  version: "4.0.7",
  categories: [
    {
      name: "Details",
      filters: [
        {
          name: "Sharpen [Unsharp Mask]",
          category: "Details",
          command: "fx_unsharp",
          previewScale: "actual",
          params: [
            { kind: "float", name: "Radius", pos: 1, default: 1.25, min: 0, max: 20 },
            { kind: "point", name: "Centre", pos: 2, default: [50, 50] },
            { kind: "int", name: "Iterations", pos: 4, default: 1, min: 1, max: 10 },
          ],
        },
      ],
    },
  ],
};

const filter = (values: Step["values"], on = true): Step => ({ id: "f", on, kind: "filter", name: "Sharpen [Unsharp Mask]", command: "fx_unsharp", values });

describe("stepJobs", () => {
  it("runs the enabled steps only, each filter with its values and the defaults of the rest", () => {
    const steps: Step[] = [
      filter({ Radius: 3 }),
      filter({ Radius: 9 }, false),
      { id: "s", on: true, kind: "script", name: "Glow", source: "#@gui : Strength = float(2,0,10)\nblur $1", values: { Strength: 4 } },
    ];
    expect(stepJobs(steps, catalogue)).toEqual([
      { kind: "line", line: "fx_unsharp 3,50,50,1" },
      { kind: "script", source: "#@gui : Strength = float(2,0,10)\nblur $1", args: "4" },
    ]);
  });

  it("ignores a stored value of the wrong kind, and values for settings the filter no longer has", () => {
    expect(stepJobs([filter({ Radius: "big", Gone: 4, Iterations: 3 })], catalogue)).toEqual([{ kind: "line", line: "fx_unsharp 1.25,50,50,3" }]);
  });

  it("maps points from the frame to the window G'MIC is shown, for a zoomed preview", () => {
    const toWindow = ([x, y]: number[]) => [(x - 25) * 2, (y - 50) * 2];
    expect(stepJobs([filter({ Centre: [30, 60] })], catalogue, toWindow)).toEqual([{ kind: "line", line: "fx_unsharp 1.25,10,20,1" }]);
  });

  it("names a filter this G'MIC doesn't have", () => {
    const missing: Step = { id: "m", on: true, kind: "filter", name: "Gone Filter", command: "fx_gone", values: {} };
    expect(() => stepJobs([missing], catalogue)).toThrow(/Gone Filter/);
  });

  it("needs no filter list for scripts alone", () => {
    const script: Step = { id: "s", on: true, kind: "script", name: "S", source: "blur 1", values: {} };
    expect(stepJobs([script], null)).toEqual([{ kind: "script", source: "blur 1", args: "" }]);
    expect(() => stepJobs([filter({})], null)).toThrow(/filter list/);
  });
});

describe("stepParams", () => {
  it("are a filter's from the list, or a script's from its own lines", () => {
    expect(stepParams(filter({}), catalogue).map((p) => ("name" in p ? p.name : p.kind))).toEqual(["Radius", "Centre", "Iterations"]);
    const script: Step = { id: "s", on: true, kind: "script", name: "S", source: "#@gui : A = int(1,0,5)\nblur $1", values: {} };
    expect(stepParams(script, null).map((p) => ("name" in p ? p.name : p.kind))).toEqual(["A"]);
    expect(stepParams(filter({}), null)).toEqual([]);
  });
});

describe("interactive filters in a stack", () => {
  const interactive: Catalogue = {
    version: "4.0.7",
    categories: [
      {
        name: "Colors",
        filters: [
          { name: "Curves", category: "Colors", command: "fx_curves_interactive", preview: "fx_curves_interactive_preview", interactive: true, previewScale: "any", params: [{ kind: "fixed", name: "_", pos: 1, value: "0,0,100,100" }] },
          { name: "Color Mask", category: "Colors", command: "fx_mask_color", preview: null, interactive: true, previewScale: "any", params: [] },
        ],
      },
    ],
  };
  const step = (command: string, name: string): Step => ({ id: command, on: true, kind: "filter", name, command, values: {} });

  it("run what their editor drew, through Safelight's own command, never G'MIC's window", () => {
    const [job] = stepJobs([{ ...step("fx_curves_interactive", "Curves"), data: { curves: [[0, 100, 100, 0]] } }], interactive);
    expect(job.kind).toBe("script");
    if (job.kind !== "script") return;
    expect(job.source).toContain('_sl_curves 0,"\\"0,100,100,0,-1,0,0,100,100');
    expect(job.source).not.toContain("fx_curves_interactive");
  });

  it("without one, say they need G'MIC's own window", () => {
    expect(() => stepJobs([step("fx_mask_color", "Color Mask")], interactive)).toThrow(/Color Mask.*G'MIC's own window/);
  });
});
