import { describe, expect, it } from "vitest";
import { argList, defaultsOf, gmicLine, quote, valuesFromAssignments, type Param } from "../src/gmic/params";

const PARAMS: Param[] = [
  { kind: "note", text: "A note" },
  { kind: "choice", name: "Sharpening Type", pos: 1, default: 1, choices: ["Gaussian", "Bilateral"] },
  { kind: "float", name: "Spatial Radius", pos: 2, default: 1.25, min: 0, max: 20 },
  { kind: "int", name: "Iterations", pos: 3, default: 1, min: 1, max: 10 },
  { kind: "bool", name: "Negative Effect", pos: 4, default: false },
  { kind: "text", name: "Text", pos: 5, default: 'Say "hi"' },
  { kind: "color", name: "Colour", pos: 6, default: [255, 128, 0] },
  { kind: "point", name: "Position", pos: 9, default: [50, 90] },
  { kind: "fixed", name: "Font", pos: 11, value: '""' },
];

describe("defaultsOf / argList", () => {
  it("gives every parameter its default, in G'MIC's argument order", () => {
    expect(argList(PARAMS, defaultsOf(PARAMS))).toBe('1,1.25,1,0,"Say \\"hi\\"",255,128,0,50,90,""');
  });

  it("orders by position, not by listing", () => {
    const shuffled = [PARAMS[3], PARAMS[1], PARAMS[2]];
    expect(argList(shuffled, defaultsOf(shuffled))).toBe("1,1.25,1");
  });

  it("clamps numbers to their range and rounds ints", () => {
    const values = { ...defaultsOf(PARAMS), "Spatial Radius": 99, Iterations: 2.6 };
    expect(argList(PARAMS, values).split(",").slice(1, 3)).toEqual(["20", "3"]);
  });

  it("writes numbers without exponents", () => {
    const values = { ...defaultsOf(PARAMS), "Spatial Radius": 0.0000001 };
    expect(argList(PARAMS, values).split(",")[1]).toBe("0.0000001");
  });
});

describe("valuesFromAssignments", () => {
  it("sets values by name, ignoring case and spaces, from Name=value words", () => {
    const values = valuesFromAssignments(PARAMS, ["radius=3", "iterations=4", "negativeeffect=on"]);
    expect(values["Spatial Radius"]).toBe(3);
    expect(values.Iterations).toBe(4);
    expect(values["Negative Effect"]).toBe(true);
  });

  it("takes a choice by its label or its number", () => {
    expect(valuesFromAssignments(PARAMS, ["type=gaussian"])["Sharpening Type"]).toBe(0);
    expect(valuesFromAssignments(PARAMS, ["sharpening-type=1"])["Sharpening Type"]).toBe(1);
  });

  it("takes colours as #rrggbb or comma lists, and points as x,y", () => {
    const values = valuesFromAssignments(PARAMS, ["colour=#102030", "position=10,20"]);
    expect(values.Colour).toEqual([16, 32, 48]);
    expect(values.Position).toEqual([10, 20]);
  });

  it("refuses a name that matches nothing or more than one parameter", () => {
    expect(() => valuesFromAssignments(PARAMS, ["blur=3"])).toThrow(/No parameter "blur"/);
    expect(() => valuesFromAssignments(PARAMS, ["s=3"])).toThrow(/"s" could be/);
  });

  it("refuses a value of the wrong kind", () => {
    expect(() => valuesFromAssignments(PARAMS, ["radius=big"])).toThrow(/Spatial Radius takes a number/);
    expect(() => valuesFromAssignments(PARAMS, ["type=median"])).toThrow(/Gaussian, Bilateral/);
  });

  it("refuses a word that isn't an assignment", () => {
    expect(() => valuesFromAssignments(PARAMS, ["radius"])).toThrow(/Name=value/);
  });
});

describe("quote / gmicLine", () => {
  it("quotes only what needs it", () => {
    expect(quote("blur")).toBe("blur");
    expect(quote("a b")).toBe('"a b"');
    expect(quote("")).toBe('""');
    expect(quote('say "x"')).toBe('"say \\"x\\""');
  });

  it("joins console words into one G'MIC line", () => {
    expect(gmicLine(["-blur", "3", "text", "Hello there"])).toBe('-blur 3 text "Hello there"');
  });
});
