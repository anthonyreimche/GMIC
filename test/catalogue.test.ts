import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findFilter, parseFilterFile, searchFilters } from "../src/gmic/catalogue";

const fixture = readFileSync(join(__dirname, "fixtures", "filters.gmic"), "utf8");

describe("parseFilterFile", () => {
  const catalogue = parseFilterFile(fixture);

  it("reads the version the file is for", () => {
    expect(catalogue.version).toBe("4.0.8");
  });

  it("groups filters by folder, without markup, folders met twice merged, empty ones left out", () => {
    expect(catalogue.categories.map((c) => c.name)).toEqual(["Details", "Artistic", "Artistic › Frames", "Corvo"]);
    expect(catalogue.categories[0].filters.map((f) => f.name)).toEqual(["Sharpen [Unsharp Mask]", "Sharpen [Texture]"]);
  });

  it("leaves out filters with no command and other languages' copies", () => {
    expect(catalogue.categories.flatMap((c) => c.filters).map((f) => f.command)).toEqual([
      "fx_unsharp",
      "fx_sharpen_texture",
      "fx_caption",
      "fx_old_frame",
      "fx_old_look",
    ]);
  });

  it("decodes entities in names", () => {
    expect(catalogue.categories[1].filters[0].name).toBe("Caption & Frame");
  });

  it("types each setting, numbering their argument positions", () => {
    expect(catalogue.categories[0].filters[0].params).toEqual([
      { kind: "note", text: "Description: Classic unsharp mask sharpening." },
      { kind: "separator" },
      { kind: "choice", name: "Sharpening Type", pos: 1, default: 1, choices: ["Gaussian", "Bilateral"] },
      { kind: "float", name: "Spatial Radius", pos: 2, default: 1.25, min: 0, max: 20 },
      { kind: "int", name: "Iterations", pos: 3, default: 1, min: 1, max: 10 },
      { kind: "bool", name: "Negative Effect", pos: 4, default: false },
      { kind: "link", name: "Docs", url: "https://gmic.eu" },
    ]);
  });

  it("reads colours, points, text, the fixed kinds and choices without a default", () => {
    expect(catalogue.categories[1].filters[0].params).toEqual([
      { kind: "text", name: "Text", pos: 1, default: 'Hello "world"' },
      { kind: "color", name: "Colour", pos: 2, default: [255, 128, 0, 255] },
      { kind: "point", name: "Position", pos: 6, default: [50, 90] },
      { kind: "fixed", name: "Randomize", pos: 8, value: "0" },
      { kind: "fixed", name: "Font", pos: 9, value: '""' },
      { kind: "choice", name: "Mode", pos: 10, default: 0, choices: ["A", "B"] },
    ]);
  });

  it("nests a folder named without underscores in the open one; each underscore steps back out", () => {
    expect(catalogue.categories[2].filters.map((f) => f.command)).toEqual(["fx_old_frame"]);
    expect(catalogue.categories[3].name).toBe("Corvo");
  });

  it("reads the spaced form G'MIC's own library uses too", () => {
    const old = catalogue.categories[3].filters[0];
    expect(old).toMatchObject({ name: "Old Look", command: "fx_old_look" });
    expect(old.params).toEqual([{ kind: "float", name: "Strength", pos: 1, default: 0.5, min: 0, max: 1 }]);
  });

  it("finds no filters in text that isn't a filter file", () => {
    expect(parseFilterFile("[gmic] oops").categories).toEqual([]);
  });
});

describe("findFilter / searchFilters", () => {
  const catalogue = parseFilterFile(fixture);

  it("finds a filter by name, case-insensitively, or by command", () => {
    expect(findFilter(catalogue, "sharpen [unsharp mask]")?.command).toBe("fx_unsharp");
    expect(findFilter(catalogue, "fx_caption")?.name).toBe("Caption & Frame");
    expect(findFilter(catalogue, "nothing")).toBeNull();
  });

  it("searches names, categories and commands by every word", () => {
    expect(searchFilters(catalogue, "unsharp").map((f) => f.name)).toEqual(["Sharpen [Unsharp Mask]"]);
    expect(searchFilters(catalogue, "artistic frame").map((f) => f.name)).toEqual(["Caption & Frame", "Old Frame"]);
    expect(searchFilters(catalogue, "")).toHaveLength(5);
  });
});
