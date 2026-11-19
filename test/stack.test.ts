import { describe, expect, it } from "vitest";
import {
  INSTALLED,
  installFilter,
  installScript,
  itemKey,
  moveItem,
  photoSteps,
  readInstalled,
  readState,
  uninstall,
  updateScript,
  withValue,
  writeInstalled,
  type Item,
} from "../src/stack";
import type { Filter } from "../src/gmic/catalogue";

const unsharp: Filter = {
  name: "Sharpen [Unsharp Mask]",
  category: "Details",
  command: "fx_unsharp",
  previewScale: "actual",
  params: [
    { kind: "float", name: "Radius", pos: 1, default: 1.25, min: 0, max: 20 },
    { kind: "point", name: "Centre", pos: 2, default: [50, 50] },
  ],
};

function settings(initial: Record<string, unknown> = {}) {
  const map = new Map(Object.entries(initial));
  return { map, get: <T,>(k: string, f: T) => (map.has(k) ? (map.get(k) as T) : f), set: (k: string, v: unknown) => void map.set(k, v) };
}

let n = 0;
const id = () => `i${++n}`;

describe("the installed list", () => {
  it("reads well-formed items once each, in order", () => {
    const good: Item = { id: "a", kind: "filter", name: "F", command: "fx_f" };
    const script: Item = { id: "b", kind: "script", name: "S", source: "blur 1" };
    const s = settings({ [INSTALLED]: [good, { id: "x" }, script, { ...good, name: "dupe" }, { ...script, id: "bad id!" }] });
    expect(readInstalled(s)).toEqual([good, script]);
    expect(readInstalled(settings())).toEqual([]);
  });

  it("installs a filter once, at the end; scripts as many times as written", () => {
    const once = installFilter([], unsharp, id);
    expect(once).toEqual([{ id: "i1", kind: "filter", name: "Sharpen [Unsharp Mask]", command: "fx_unsharp" }]);
    expect(installFilter(once, unsharp, id)).toEqual(once);
    const both = installScript(installScript(once, "Glow", "blur 2", id), "Glow", "blur 3", id);
    expect(both.map((i) => i.name)).toEqual(["Sharpen [Unsharp Mask]", "Glow", "Glow"]);
  });

  it("moves, edits and uninstalls without changing the list it came from", () => {
    const items: Item[] = [
      { id: "a", kind: "filter", name: "A", command: "fx_a" },
      { id: "b", kind: "script", name: "B", source: "blur 1" },
      { id: "c", kind: "filter", name: "C", command: "fx_c" },
    ];
    expect(moveItem(items, "c", 0).map((i) => i.id)).toEqual(["c", "a", "b"]);
    expect(moveItem(items, "a", 9).map((i) => i.id)).toEqual(["b", "c", "a"]);
    expect(updateScript(items, "b", { source: "blur 4" })[1]).toEqual({ id: "b", kind: "script", name: "B", source: "blur 4" });
    expect(updateScript(items, "a", { name: "nope" })[0].name).toBe("A");
    expect(uninstall(items, "b").map((i) => i.id)).toEqual(["a", "c"]);
    expect(items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("writes only the fields an item has", () => {
    const s = settings();
    writeInstalled(s, [{ id: "a", kind: "filter", name: "A", command: "fx_a", extra: 1 } as Item]);
    expect(s.map.get(INSTALLED)).toEqual([{ id: "a", kind: "filter", name: "A", command: "fx_a" }]);
  });
});

describe("a photo's use of the installed items", () => {
  const items: Item[] = [
    { id: "a", kind: "filter", name: "A", command: "fx_a" },
    { id: "b", kind: "script", name: "B", source: "blur $1" },
    { id: "c", kind: "filter", name: "C", command: "fx_c" },
  ];

  it("is kept under each item's key", () => {
    expect(itemKey("a")).toBe("gmic.f.a");
    expect(readState({ "gmic.f.a": { on: true, values: { R: 2 } } }, "a")).toEqual({ on: true, values: { R: 2 } });
    expect(readState({ "gmic.f.a": { on: "yes", values: {} } }, "a")).toBeNull();
    expect(readState({}, "a")).toBeNull();
  });

  it("runs the switched-on items in the installed order, less any held off", () => {
    const bag = {
      "gmic.f.c": { on: true, values: { X: 1 } },
      "gmic.f.a": { on: true, values: {} },
      "gmic.f.b": { on: false, values: {} },
    };
    expect(photoSteps(items, bag).map((s) => s.id)).toEqual(["a", "c"]);
    expect(photoSteps(items, bag, (i) => i === "a").map((s) => s.id)).toEqual(["c"]);
    expect(photoSteps(items, bag)[1]).toEqual({ ...items[2], on: true, values: { X: 1 } });
  });

  it("a value set while off switches the item on", () => {
    expect(withValue(null, "R", 3)).toEqual({ on: true, values: { R: 3 } });
    expect(withValue({ on: false, values: { R: 1, S: 2 } }, "R", 3)).toEqual({ on: true, values: { R: 3, S: 2 } });
  });
});
