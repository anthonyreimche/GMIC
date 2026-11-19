import { describe, expect, it } from "vitest";
import {
  IDENTITY,
  addPoint,
  colorizeJob,
  curveAt,
  curvesJob,
  movePoint,
  readCurves,
  readPoints,
  removePoint,
  warpJob,
} from "../src/interactive/models";
import { stackFile } from "../src/gmic/script";

describe("curves", () => {
  it("reads five curves, identity where one is missing or malformed", () => {
    const curves = readCurves({ curves: [[0, 10, 100, 90], [0, 0, 50], "x", [5, 0, 100, 100]] });
    expect(curves).toEqual([[0, 10, 100, 90], IDENTITY, IDENTITY, IDENTITY, IDENTITY]);
    expect(readCurves(undefined)).toHaveLength(5);
  });

  it("interpolate as G'MIC's function1d 1 does", () => {
    const c = [0, 0, 25, 40, 60, 50, 100, 100];
    expect(curveAt(c, 10)).toBeCloseTo(17.84, 1);
    expect(curveAt(c, 25)).toBeCloseTo(40, 5);
    expect(curveAt(c, 40)).toBeCloseTo(45.08, 1);
    expect(curveAt(IDENTITY, 37)).toBeCloseTo(37, 5);
  });

  it("add a point in order, but not on top of another", () => {
    expect(addPoint(IDENTITY, 30, 60)).toEqual({ curve: [0, 0, 30, 60, 100, 100], index: 1 });
    const { curve } = addPoint(IDENTITY, 30, 60);
    expect(addPoint(curve, 30.2, 10)).toEqual({ curve, index: -1 });
  });

  it("move a point between its neighbours; the ends only up and down", () => {
    const c = [0, 0, 30, 60, 100, 100];
    expect(movePoint(c, 1, 120, 150)).toEqual([0, 0, 99.5, 100, 100, 100]);
    expect(movePoint(c, 0, 40, 20)).toEqual([0, 20, 30, 60, 100, 100]);
    expect(movePoint(c, 2, 10, -5)).toEqual([0, 0, 30, 60, 100, 0]);
  });

  it("remove a point, never an end", () => {
    const c = [0, 0, 30, 60, 100, 100];
    expect(removePoint(c, 1)).toEqual(IDENTITY);
    expect(removePoint(c, 0)).toBe(c);
    expect(removePoint(c, 2)).toBe(c);
  });

  it("run as _sl_curves with the colour space and all five curves as one quoted list", () => {
    const job = curvesJob({ "Color Space": 6 }, { curves: [[0, 0, 25, 40, 100, 100]] });
    expect(job.kind).toBe("script");
    if (job.kind !== "script") return;
    expect(job.source).toContain("_sl_curves : check");
    expect(job.source).toContain('main :\n  _sl_curves 6,"\\"0,0,25,40,100,100,-1,0,0,100,100,-1,0,0,100,100,-1,0,0,100,100,-1,0,0,100,100\\""');
    expect(stackFile([job])).toContain("_sl_main_1 :\n  _sl_curves 6,");
  });
});

describe("warp", () => {
  it("always passes the four corners, then the keypoints", () => {
    const job = warpJob({ points: [[60, 50, 50, 50], [1, 2]] });
    if (job.kind !== "script") throw new Error("script expected");
    expect(job.source).toContain('_sl_warp "\\"0,0,0,0,100,0,100,0,0,100,0,100,100,100,100,100,60,50,50,50\\""');
  });

  it("moves both ends of each keypoint, corners too, into a zoomed preview's window", () => {
    const half = ([x, y]: number[]) => [x * 2, y * 2];
    const job = warpJob({ points: [[30, 20, 25, 20]] }, half);
    if (job.kind !== "script") throw new Error("script expected");
    expect(job.source).toContain('"\\"0,0,0,0,200,0,200,0,0,200,0,200,200,200,200,200,60,40,50,40\\""');
  });
});

describe("colorize", () => {
  it("passes the input type and each point's position and colour", () => {
    const job = colorizeJob({ "Input Type": 1 }, { points: [[10, 20, 255, 0, 0], [5, 5]] });
    if (job.kind !== "script") throw new Error("script expected");
    expect(job.source).toContain('_sl_colorize 1,"\\"10,20,255,0,0\\""');
    expect(readPoints({ points: [[10, 20, 255, 0, 0], [5, 5]] }, 5)).toEqual([[10, 20, 255, 0, 0]]);
  });
});
