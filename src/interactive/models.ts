// What the interactive editors keep, and the jobs that apply it. Curves are
// x,y pairs in 0–100, drawn as G'MIC's `function1d 1` draws them; warp
// keypoints and colour points are positions in % of the photo's frame.

import { num, type ParamValues } from "../gmic/params";
import type { Job } from "../gmic/script";
import type { PointMap } from "./editors";
import { COLORIZE, CURVES, WARP } from "./snippets";

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A command file running `call` with the snippet defining it. */
const snippetJob = (snippet: string, call: string): Job => ({ kind: "script", source: `${snippet}\nmain :\n  ${call}\n`, args: "" });

/** A list argument as G'MIC's commands take one: in quotes, inside quotes. */
const listArg = (values: readonly number[]) => `"\\"${values.map(num).join(",")}\\""`;

// ---- Curves -------------------------------------------------------------

/** A curve's points, flat x,y pairs sorted by x, from x 0 to x 100. */
export type Curve = number[];

export const CURVE_COUNT = 5;
export const IDENTITY: Curve = [0, 0, 100, 100];
/** The closest two points of a curve may be along x. */
export const MIN_GAP = 0.5;

/** The channels each colour space's curves edit, in order (G'MIC's
 *  `Color Space` choice). Curves past these touch alpha only. */
export const CURVE_CHANNELS: readonly (readonly string[])[] = [
  ["Red", "Green", "Blue"],
  ["Cyan", "Magenta", "Yellow"],
  ["Cyan", "Magenta", "Yellow", "Key"],
  ["Hue", "Saturation", "Intensity"],
  ["Hue", "Saturation", "Lightness"],
  ["Hue", "Saturation", "Value"],
  ["Lightness", "a", "b"],
  ["Lightness", "Chroma", "Hue"],
  ["Luma", "Blue difference", "Red difference"],
];

function isCurve(v: unknown): v is Curve {
  if (!Array.isArray(v) || v.length < 4 || v.length % 2 !== 0 || !v.every(finite)) return false;
  for (let i = 2; i < v.length; i += 2) if (v[i] <= v[i - 2]) return false;
  return v[0] === 0 && v[v.length - 2] === 100;
}

/** The five curves stored, identity where one is missing or malformed. */
export function readCurves(data: unknown): Curve[] {
  const stored = isRecord(data) && Array.isArray(data.curves) ? data.curves : [];
  return Array.from({ length: CURVE_COUNT }, (_, i) => (isCurve(stored[i]) ? [...stored[i]] : [...IDENTITY]));
}

const xs = (c: Curve) => c.filter((_, i) => i % 2 === 0);
const ys = (c: Curve) => c.filter((_, i) => i % 2 === 1);

/** The curve's y at `x`, as G'MIC's `function1d 1` interpolates it: cubic
 *  Hermite segments, each point's slope the secant through its neighbours
 *  (one-sided at the ends), and segments under one unit long straight. */
export function curveAt(curve: Curve, x: number): number {
  const X = xs(curve);
  const Y = ys(curve);
  const n = X.length;
  if (x <= X[0]) return Y[0];
  if (x >= X[n - 1]) return Y[n - 1];
  let i = 0;
  while (X[i + 1] < x) i++;
  const x0 = X[i];
  const x1 = X[i + 1];
  const y0 = Y[i];
  const y1 = Y[i + 1];
  const dx = x1 - x0;
  const t = (x - x0) / dx;
  if (dx < 1) return y0 + (y1 - y0) * t;
  const slope = (k: number) => (k === 0 ? (Y[1] - Y[0]) / (X[1] - X[0]) : k === n - 1 ? (Y[k] - Y[k - 1]) / (X[k] - X[k - 1]) : (Y[k + 1] - Y[k - 1]) / (X[k + 1] - X[k - 1]));
  const m0 = slope(i) * dx;
  const m1 = slope(i + 1) * dx;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * m1;
}

/** The curve with a point at (x, y), unless one is closer than MIN_GAP;
 *  then the index it's at, or -1 when there's no room. */
export function addPoint(curve: Curve, x: number, y: number): { curve: Curve; index: number } {
  const X = xs(curve);
  const px = clamp(x, 0, 100);
  if (X.some((v) => Math.abs(v - px) < MIN_GAP)) return { curve, index: -1 };
  const index = X.findIndex((v) => v > px);
  const out = [...curve];
  out.splice(index * 2, 0, px, clamp(y, 0, 100));
  return { curve: out, index };
}

/** Point `index` moved: the ends keep their x, the rest stay between their
 *  neighbours. */
export function movePoint(curve: Curve, index: number, x: number, y: number): Curve {
  const n = curve.length / 2;
  const out = [...curve];
  const lo = index === 0 ? 0 : index === n - 1 ? 100 : curve[(index - 1) * 2] + MIN_GAP;
  const hi = index === 0 ? 0 : index === n - 1 ? 100 : curve[(index + 1) * 2] - MIN_GAP;
  out[index * 2] = clamp(x, lo, hi);
  out[index * 2 + 1] = clamp(y, 0, 100);
  return out;
}

/** Point `index` taken out; the ends stay. */
export function removePoint(curve: Curve, index: number): Curve {
  if (index <= 0 || index >= curve.length / 2 - 1) return curve;
  const out = [...curve];
  out.splice(index * 2, 2);
  return out;
}

export const COLOR_SPACE = "Color Space";

export function curvesJob(values: ParamValues, data: unknown): Job {
  const space = clamp(Math.round(Number(values[COLOR_SPACE] ?? 0)) || 0, 0, 8);
  const curves = readCurves(data);
  const list = curves.flatMap((c, i) => (i === 0 ? c : [-1, ...c]));
  return snippetJob(CURVES, `_sl_curves ${space},${listArg(list)}`);
}

// ---- Points (warp keypoints, colour points) -----------------------------

/** Points of `size` numbers each, the first two a position in %. */
export function readPoints(data: unknown, size: number): number[][] {
  const stored = isRecord(data) && Array.isArray(data.points) ? data.points : [];
  return stored.filter((p): p is number[] => Array.isArray(p) && p.length === size && p.every(finite)).map((p) => [...p]);
}

const mapped = (map: PointMap | undefined, x: number, y: number): number[] => (map ? map([x, y]) : [x, y]);

/** Warp keypoints `[dx, dy, sx, sy]`: what was at (sx, sy) shows at
 *  (dx, dy). */
export const WARP_SIZE = 4;
const CORNERS = [
  [0, 0, 0, 0],
  [100, 0, 100, 0],
  [0, 100, 0, 100],
  [100, 100, 100, 100],
];

export function warpJob(data: unknown, map?: PointMap): Job {
  const points = [...CORNERS, ...readPoints(data, WARP_SIZE)].flatMap(([dx, dy, sx, sy]) => [...mapped(map, dx, dy), ...mapped(map, sx, sy)]);
  return snippetJob(WARP, `_sl_warp ${listArg(points)}`);
}

/** Colour points `[x, y, r, g, b]`, the colour 0–255. */
export const COLOUR_SIZE = 5;
export const INPUT_TYPE = "Input Type";

export function colorizeJob(values: ParamValues, data: unknown, map?: PointMap): Job {
  const type = Number(values[INPUT_TYPE] ?? 0) === 1 ? 1 : 0;
  const points = readPoints(data, COLOUR_SIZE).flatMap(([x, y, r, g, b]) => [...mapped(map, x, y), r, g, b]);
  return snippetJob(COLORIZE, `_sl_colorize ${type},${listArg(points)}`);
}
