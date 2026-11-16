import { describe, expect, it } from "vitest";
import { CATALOGUE, ENTRY, RUN, catalogueFile, commandFile, scriptParams, type Job } from "../src/gmic/script";

describe("commandFile", () => {
  it("runs a pipeline between the 0–255 scaling and the 16-bit write-back", () => {
    const file = commandFile({ kind: "line", line: "blur 3 sharpen 50" });
    expect(file).toBe(
      [
        `${RUN} :`,
        "  div 257",
        `  ${ENTRY}`,
        "  foreach { cut 0,255 mul 257 }",
        "",
        `${ENTRY} :`,
        "  blur 3 sharpen 50",
        "",
      ].join("\n"),
    );
  });

  it("leaves 8-bit input as it is: only 16-bit input is scaled down", () => {
    const file = commandFile({ kind: "line", line: "blur 3" }, 8);
    expect(file).not.toContain("div 257");
    expect(file).toContain("foreach { cut 0,255 mul 257 }");
  });

  it("calls a filter with its argument list", () => {
    expect(commandFile({ kind: "line", line: "fx_unsharp 1,1.25" })).toContain(`${ENTRY} :\n  fx_unsharp 1,1.25\n`);
  });

  it("wraps a script without definitions as the body, keeping its lines", () => {
    const job: Job = { kind: "script", source: "# soften\nblur 2\n\nsharpen $1", args: "40" };
    const file = commandFile(job);
    expect(file).toContain(`  ${ENTRY}_body 40\n`);
    expect(file).toContain(`${ENTRY}_body :\n  # soften\n  blur 2\n\n  sharpen $1\n`);
  });

  it("calls main in a script that defines commands, with the definitions kept as written", () => {
    const source = "main :\n  my_tone $1\n\nmy_tone :\n  mul $1";
    const file = commandFile({ kind: "script", source, args: "1.2" });
    expect(file).toContain(`  main 1.2\n`);
    expect(file.endsWith(`${source}\n`)).toBe(true);
  });

  it("refuses a script that defines commands but no main", () => {
    expect(() => commandFile({ kind: "script", source: "tone :\n  mul 2", args: "" })).toThrow(/main/);
  });

  it("does not take an indented line or a comment for a definition", () => {
    const file = commandFile({ kind: "script", source: "  x : y\n# a : b\nblur 1", args: "" });
    expect(file).toContain(`${ENTRY}_body`);
  });
});

describe("scriptParams", () => {
  it("reads #@gui parameter lines in G'MIC-Qt's own syntax", () => {
    const source = [
      "#@gui My Look : main",
      "#@gui : Strength = float(0.5,0,1)",
      "#@gui : Passes = int(2,1,8)",
      "#@gui : Mode = choice(1,\"Soft\",\"Hard\")",
      "#@gui : Keep Colour = bool(1)",
      "#@gui : Tint = color(255,200,180)",
      "#@gui : Label = text(\"Hi, there\")",
      "#@gui : sep = separator()",
      "main :",
      "  blur $1",
    ].join("\n");
    expect(scriptParams(source)).toEqual([
      { kind: "float", name: "Strength", pos: 1, default: 0.5, min: 0, max: 1 },
      { kind: "int", name: "Passes", pos: 2, default: 2, min: 1, max: 8 },
      { kind: "choice", name: "Mode", pos: 3, default: 1, choices: ["Soft", "Hard"] },
      { kind: "bool", name: "Keep Colour", pos: 4, default: true },
      { kind: "color", name: "Tint", pos: 5, default: [255, 200, 180] },
      { kind: "text", name: "Label", pos: 8, default: "Hi, there" },
      { kind: "separator" },
    ]);
  });

  it("joins continued lines and ignores parameters it can't read", () => {
    const source = "#@gui : Amount = float(1,\\\n#  0,2)\n#@gui : Odd = gizmo(1)";
    expect(scriptParams(source)).toEqual([{ kind: "float", name: "Amount", pos: 1, default: 1, min: 0, max: 2 }]);
  });

  it("gives a script with no #@gui lines no parameters", () => {
    expect(scriptParams("blur 3")).toEqual([]);
  });
});

describe("catalogueFile", () => {
  it("unpacks G'MIC's downloaded filter definitions to filters.gmic", () => {
    const file = catalogueFile();
    expect(file.startsWith(`${CATALOGUE} :\n`)).toBe(true);
    expect(file).toContain("i cimgz:${_path_rc}update$_version.gmic");
    expect(file).toContain("o[-1] raw:filters.gmic,uint8");
  });
});
