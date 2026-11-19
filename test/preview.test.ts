import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewController, composite, placeIn, textureEdge, windowMap, type Area, type Captured, type PreviewIO, type PreviewRequest } from "../src/preview";
import { READY_ALPHA, texture } from "../src/stage";
import type { Planar } from "../src/gmic/cimg";
import type { Step } from "../src/stack";

const step = (on = true, value = 1): Step => ({ id: "a", on, kind: "script", name: "S", source: "blur $1", values: { V: value } });

function frame(area: Area = [0, 0, 1, 1], width = 2, height = 1): Captured {
  return { rgba: new Float32Array(width * height * 4).fill(0.5), width, height, area };
}

function rig() {
  const log: string[] = [];
  let release: (() => void) | null = null;
  let hold = false;
  let fail: Error | null = null;
  let size: [number, number] | null = null;
  let area: Area = [0, 0, 1, 1];
  const io: PreviewIO = {
    delay: 100,
    capture: async () => {
      log.push("capture");
      return frame(area);
    },
    run: async (input: Planar) => {
      log.push("run");
      if (hold) await new Promise<void>((r) => (release = r));
      if (fail) throw fail;
      const [w, h] = size ?? [input.width, input.height];
      return { width: w, height: h, channels: 3, data: new Float32Array(w * h * 3).fill(255) };
    },
    upload: (_variant, result) => log.push(`upload ${result.width}x${result.height}`),
    forget: (variant) => log.push(`forget ${variant}`),
    view: (mode, a, place) => log.push(`view ${mode} ${a.join(",")} ${place.map((n) => +n.toFixed(3)).join(",")}`),
    status: (s) => log.push(s.error ? `error ${s.error}` : s.busy ? "busy" : "idle"),
  };
  return {
    io,
    log,
    hold: (on: boolean) => (hold = on),
    release: () => release?.(),
    fail: (e: Error | null) => (fail = e),
    resultSize: (s: [number, number]) => (size = s),
    showArea: (a: Area) => (area = a),
  };
}

const request = (over: Partial<PreviewRequest> = {}): PreviewRequest => ({ stack: [step()], frame: "f1", upstream: "u1", area: [0, 0, 1, 1], maxEdge: 2048, held: false, ...over });
const settle = async (ms = 100) => {
  await vi.advanceTimersByTimeAsync(ms);
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("PreviewController", () => {
  it("does nothing without an enabled step", async () => {
    const r = rig();
    const c = new PreviewController(r.io);
    c.update(request({ stack: [step(false)] }));
    c.update(null);
    await settle(500);
    expect(r.log.filter((l) => l !== "idle")).toEqual([]);
  });

  it("runs once the changes settle, then shows the result exactly", async () => {
    const r = rig();
    const c = new PreviewController(r.io);
    c.update(request({ stack: [step(true, 1)] }));
    await settle(50);
    c.update(request({ stack: [step(true, 2)] }));
    await settle(50);
    expect(r.log).toEqual([]);
    await settle(60);
    expect(r.log).toEqual(["busy", "capture", "run", "upload 2x1", "view 1 0,0,1,1 0,0,1,1", "idle"]);
  });

  it("doesn't run again for the same request", async () => {
    const r = rig();
    const c = new PreviewController(r.io);
    c.update(request());
    await settle(200);
    r.log.length = 0;
    c.update(request());
    await settle(200);
    expect(r.log).toEqual([]);
  });

  it("follows other edits approximately at once, then exactly", async () => {
    const r = rig();
    const c = new PreviewController(r.io);
    c.update(request());
    await settle(200);
    r.log.length = 0;
    c.update(request({ upstream: "u2" }));
    expect(r.log).toEqual(["view 2 0,0,1,1 0,0,1,1"]);
    await settle(200);
    expect(r.log.at(-2)).toBe("view 1 0,0,1,1 0,0,1,1");
  });

  it("runs one at a time and catches up with the latest edit after", async () => {
    const r = rig();
    const c = new PreviewController(r.io);
    r.hold(true);
    c.update(request({ stack: [step(true, 1)] }));
    await settle(100);
    c.update(request({ stack: [step(true, 2)] }));
    c.update(request({ stack: [step(true, 3)] }));
    await settle(500);
    expect(r.log.filter((l) => l === "run")).toHaveLength(1);
    r.hold(false);
    r.release();
    await settle(10);
    expect(r.log.filter((l) => l === "run")).toHaveLength(2);
  });

  it("turns the stage off when the last step goes, and drops a run in flight", async () => {
    const r = rig();
    const c = new PreviewController(r.io);
    c.update(request());
    await settle(200);
    r.hold(true);
    c.update(request({ upstream: "u2" }));
    await settle(100);
    r.log.length = 0;
    c.update(request({ stack: [] }));
    expect(r.log).toEqual(["view 0 0,0,1,1 0,0,1,1", "idle"]);
    r.release();
    await settle(10);
    expect(r.log.some((l) => l.startsWith("upload"))).toBe(false);
  });

  it("shows G'MIC's error and turns the stage off; it waits for a change to try again", async () => {
    const r = rig();
    const c = new PreviewController(r.io);
    c.update(request());
    await settle(200);
    r.fail(new Error("G'MIC: *** Unknown command"));
    c.update(request({ stack: [step(true, 2)] }));
    await settle(200);
    expect(r.log.slice(-2)).toEqual(["view 0 0,0,1,1 0,0,1,1", "error G'MIC: *** Unknown command"]);
    r.log.length = 0;
    await settle(1000);
    expect(r.log).toEqual([]);
  });

  it("turns the stage off, not approximate, for another photo or another framing", async () => {
    const r = rig();
    const c = new PreviewController(r.io);
    c.update(request());
    await settle(200);
    r.log.length = 0;
    c.update(request({ frame: "f2", upstream: "u2" }));
    expect(r.log).toEqual(["view 0 0,0,1,1 0,0,1,1", "forget r1"]);
    await settle(200);
    expect(r.log.at(-2)).toBe("view 1 0,0,1,1 0,0,1,1");
  });

  it("while another panel is held off, shows the change approximately at once and runs nothing; letting go goes back to exact", async () => {
    const r = rig();
    const c = new PreviewController(r.io);
    c.update(request());
    await settle(200);
    r.log.length = 0;
    c.update(request({ held: true }));
    await settle(500);
    expect(r.log).toEqual(["view 2 0,0,1,1 0,0,1,1"]);
    c.update(request());
    await settle(500);
    expect(r.log).toEqual(["view 2 0,0,1,1 0,0,1,1", "view 1 0,0,1,1 0,0,1,1"]);
  });

  it("an edit undone before it settles runs nothing and goes back to exact", async () => {
    const r = rig();
    const c = new PreviewController(r.io);
    c.update(request());
    await settle(200);
    r.log.length = 0;
    c.update(request({ upstream: "u2" }));
    await settle(50);
    c.update(request());
    await settle(500);
    expect(r.log).toEqual(["view 2 0,0,1,1 0,0,1,1", "view 1 0,0,1,1 0,0,1,1"]);
  });

  it("keeps recent results: going back to one already made shows it at once, with no run", async () => {
    const r = rig();
    const c = new PreviewController(r.io);
    c.update(request({ stack: [step(true, 1)] }));
    await settle(200);
    c.update(request({ stack: [step(true, 2)] }));
    await settle(200);
    r.log.length = 0;
    c.update(request({ stack: [step(true, 1)] }));
    expect(r.log).toEqual(["view 1 0,0,1,1 0,0,1,1"]);
    await settle(500);
    expect(r.log.filter((l) => l === "run")).toEqual([]);
  });

  it("holding a G'MIC panel off and letting go runs once, then never again", async () => {
    const r = rig();
    const c = new PreviewController(r.io);
    const both = [step(true, 1), { ...step(true, 2), id: "b" }];
    c.update(request({ stack: both }));
    await settle(200);
    c.update(request({ stack: both.slice(0, 1) }));
    await settle(200);
    r.log.length = 0;
    for (let i = 0; i < 3; i++) {
      c.update(request({ stack: both }));
      await settle(200);
      c.update(request({ stack: both.slice(0, 1) }));
      await settle(200);
    }
    expect(r.log.filter((l) => l === "run")).toEqual([]);
  });

  it("lets go of the oldest results past four, and of all of them for another photo", async () => {
    const r = rig();
    const c = new PreviewController(r.io);
    for (let v = 1; v <= 5; v++) {
      c.update(request({ stack: [step(true, v)] }));
      await settle(200);
    }
    expect(r.log.filter((l) => l.startsWith("forget"))).toEqual(["forget r1"]);
    r.log.length = 0;
    c.update(request({ frame: "f2" }));
    expect(r.log.filter((l) => l.startsWith("forget"))).toEqual(["forget r2", "forget r3", "forget r4", "forget r5"]);
  });

  it("holds no more than core lets it, letting go of the oldest before the new result goes up", async () => {
    const r = rig();
    const c = new PreviewController(r.io, { texture: 1000, held: 130 });
    for (let v = 1; v <= 3; v++) {
      c.update(request({ stack: [step(true, v)] }));
      await settle(200);
    }
    expect(r.log.filter((l) => l.startsWith("upload") || l.startsWith("forget"))).toEqual(["upload 2x1", "upload 2x1", "forget r1", "upload 2x1"]);
  });

  it("says a result is too big to preview, rather than handing core one it won't hold", async () => {
    const r = rig();
    r.resultSize([4, 4]);
    const c = new PreviewController(r.io, { texture: 100, held: 1000 });
    c.update(request());
    await settle(200);
    expect(r.log.some((l) => l.startsWith("upload"))).toBe(false);
    expect(r.log.at(-1)).toMatch(/^error .*too big to preview/);
  });

  it("places a result G'MIC resized whole inside the view", async () => {
    const r = rig();
    r.resultSize([2, 2]);
    const c = new PreviewController(r.io);
    c.update(request());
    await settle(200);
    expect(r.log).toContain("upload 2x2");
    expect(r.log).toContain("view 1 0,0,1,1 0.25,0,0.5,1");
  });

  it("draws in the window the capture covered", async () => {
    const r = rig();
    r.showArea([0.25, 0.5, 0.5, 0.5]);
    const c = new PreviewController(r.io);
    c.update(request({ area: [0.25, 0.5, 0.5, 0.5] }));
    await settle(200);
    expect(r.log).toContain("view 1 0.25,0.5,0.5,0.5 0,0,1,1");
  });
});

describe("helpers", () => {
  it("textureEdge keeps a capture of the view's shape within one texture", () => {
    const limit = 64 * 1024 * 1024;
    expect(textureEdge(1, limit)).toBe(2048);
    for (const aspect of [1.5, 2 / 3, 16 / 9]) {
      const edge = textureEdge(aspect, limit);
      const long = Math.max(aspect, 1 / aspect);
      expect(edge * Math.ceil(edge / long) * 16).toBeLessThanOrEqual(limit);
      expect((edge + 1) * Math.ceil((edge + 1) / long) * 16).toBeGreaterThan(limit);
    }
  });

  it("marks each picture it hands the stage, so one core holds no data for draws the live colour, not black", () => {
    const t = texture(new Float32Array([0.5, 0.25, 0, 1, 1, 0.5, 0.25, 1]), 2, 1, 7);
    expect([...t.data]).toEqual([0.5, 0.25, 0, READY_ALPHA, 1, 0.5, 0.25, READY_ALPHA]);
    expect(READY_ALPHA).toBeGreaterThan(1);
  });

  it("windowMap moves frame points into the window's %", () => {
    expect(windowMap([0.25, 0.5, 0.5, 0.5])([50, 75])).toEqual([50, 50]);
    expect(windowMap([0, 0, 1, 1])([10, 90])).toEqual([10, 90]);
  });

  it("placeIn centres a result of another shape", () => {
    expect(placeIn(2, 4, 2)).toEqual([0, 0, 1, 1]);
    expect(placeIn(1, 2, 1)).toEqual([0, 0.25, 1, 0.5]);
  });

  it("composite lays alpha over the input when the size is the same, else over black", () => {
    const input = frame([0, 0, 1, 1], 1, 1);
    const half: Planar = { width: 1, height: 1, channels: 4, data: new Float32Array([255, 255, 255, 127.5]) };
    expect([...composite(half, input).rgba]).toEqual([0.75, 0.75, 0.75, 1]);
    const bigger: Planar = { width: 2, height: 1, channels: 4, data: new Float32Array([255, 255, 255, 255, 255, 255, 255, 127.5]) };
    expect([...composite(bigger, input).rgba]).toEqual([1, 1, 1, 1, 0.5, 0.5, 0.5, 1]);
  });
});
