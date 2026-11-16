import { describe, expect, it } from "vitest";
import { parseWords } from "../src/gmic/words";

describe("parseWords", () => {
  it("takes plain G'MIC words as a pipeline", () => {
    expect(parseWords(["-blur", "3", "sharpen", "50"])).toEqual({ kind: "pipeline", line: "-blur 3 sharpen 50" });
  });

  it("takes everything after run as a pipeline, even a subcommand's name", () => {
    expect(parseWords(["run", "filters"])).toEqual({ kind: "pipeline", line: "filters" });
  });

  it("shows usage with no words", () => {
    expect(parseWords([])).toEqual({ kind: "usage" });
  });

  it("lists filters, with an optional search", () => {
    expect(parseWords(["filters"])).toEqual({ kind: "filters", search: "" });
    expect(parseWords(["filters", "black", "white"])).toEqual({ kind: "filters", search: "black white" });
  });

  it("runs a filter named in several words, then its Name=value words", () => {
    expect(parseWords(["filter", "Sharpen", "[Unsharp", "Mask]", "radius=3", "iterations=2"])).toEqual({
      kind: "filter",
      name: "Sharpen [Unsharp Mask]",
      assignments: ["radius=3", "iterations=2"],
    });
  });

  it("wants a filter's name", () => {
    expect(() => parseWords(["filter", "radius=3"])).toThrow(/Name a filter/);
  });

  it("runs a saved script by name, or a script's source", () => {
    expect(parseWords(["script", "Soft", "Glow", "strength=0.3"])).toEqual({
      kind: "script",
      name: "Soft Glow",
      source: null,
      assignments: ["strength=0.3"],
    });
    expect(parseWords(["script", "--source", "blur 2", "a=1"])).toEqual({
      kind: "script",
      name: null,
      source: "blur 2",
      assignments: ["a=1"],
    });
  });

  it("lists scripts, shows G'MIC's help and the status", () => {
    expect(parseWords(["scripts"])).toEqual({ kind: "scripts" });
    expect(parseWords(["help", "blur"])).toEqual({ kind: "help", topic: "blur" });
    expect(parseWords(["help"])).toEqual({ kind: "help", topic: "" });
    expect(parseWords(["status"])).toEqual({ kind: "status" });
    expect(parseWords(["update"])).toEqual({ kind: "update" });
  });
});
