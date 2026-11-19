// The live preview's timing: when to run G'MIC on the view, and what the
// stage shows meanwhile. Lazy: nothing runs without a photo and an enabled
// step; changes settle for a moment first; one run at a time, and a run that
// finishes behind the edit starts the next at once (latest wins, so a drag is
// never cancelled mid-run and the preview keeps up as it can).

import { fromRgba, toRgba, type Planar } from "./gmic/cimg";
import type { PointMap } from "./jobs";
import { MODE_APPROX, MODE_EXACT, MODE_OFF } from "./stage";
import { enabledSteps, type Stack } from "./stack";

/** x, y, width, height: a part of the frame, 0 to 1 from its top left. */
export type Area = readonly [number, number, number, number];

export interface PreviewRequest {
  stack: Stack;
  /** The photo and its framing, as one key: a result made for another can't
   *  be drawn, even approximately. */
  frame: string;
  /** Everything else in the edit, as one key: a change re-runs the preview. */
  upstream: string;
  /** Another panel's preview eye is held: the live colour shows it at once,
   *  the result's change over it, and nothing runs until it's let go. */
  held: boolean;
  /** The part of the frame the view shows. */
  area: Area;
  /** The longest edge G'MIC is given, in pixels. */
  maxEdge: number;
}

/** The view's colour, RGBA floats 0–1, display-encoded, and where it is. */
export interface Captured {
  rgba: Float32Array;
  width: number;
  height: number;
  area: Area;
}

export interface Picture {
  rgba: Float32Array;
  width: number;
  height: number;
}

export interface PreviewStatus {
  busy: boolean;
  error: string | null;
}

export interface PreviewIO {
  capture(maxEdge: number): Promise<Captured | null>;
  /** The stack run on `input` (0–255), points moved by `map`. */
  run(input: Planar, stack: Stack, map: PointMap): Promise<Planar>;
  /** New pictures for the stage, filed as `variant`: G'MIC's result and the
   *  input it came from. */
  upload(variant: string, result: Picture, basis: Picture): void;
  /** Let go of a variant's pictures. */
  forget(variant: string): void;
  /** What the stage draws, from the pictures filed as `variant`. */
  view(mode: number, area: Area, place: Area, variant: string | null): void;
  status(status: PreviewStatus): void;
  /** How long changes settle before a run, in ms. */
  delay: number;
}

const FULL: Area = [0, 0, 1, 1];

/** In bytes: what core holds of one stage texture, and of all of one
 *  extension's (docs/dev/api/contributions.md). A picture past them isn't
 *  held, and the stage has nothing of it to draw. */
export interface TextureLimits {
  texture: number;
  held: number;
}

const MB = 1024 * 1024;
export const CORE_LIMITS: TextureLimits = { texture: 64 * MB, held: 256 * MB };

/** A picture as the stage's texture holds it: four floats a pixel. */
const bytesOf = (width: number, height: number) => width * height * 16;

/** The longest edge a capture of a view `aspect` wide for each unit of height
 *  may have and still fit one texture. */
export function textureEdge(aspect: number, limit: number = CORE_LIMITS.texture): number {
  const long = Math.max(aspect, 1 / aspect);
  let edge = Math.floor(Math.sqrt((limit / 16) * long));
  while (edge > 1 && bytesOf(edge, Math.ceil(edge / long)) > limit) edge--;
  return edge;
}

/** The key of what a preview depends on. */
function keyOf(request: PreviewRequest): string {
  return JSON.stringify([enabledSteps(request.stack), request.frame, request.upstream, request.area, request.maxEdge]);
}

/** Points from % of the frame to % of `area`. */
export function windowMap(area: Area): PointMap {
  const [x, y, w, h] = area;
  return ([px, py]) => [((px / 100 - x) / w) * 100, ((py / 100 - y) / h) * 100];
}

/** Where a result of `width × height` sits, whole and centred, in an area
 *  `aspect` wide for each unit of height. */
export function placeIn(aspect: number, width: number, height: number): Area {
  const r = width / height;
  if (Math.abs(r - aspect) < 1e-6) return FULL;
  return r > aspect ? [0, (1 - aspect / r) / 2, 1, aspect / r] : [(1 - r / aspect) / 2, 0, r / aspect, 1];
}

/** G'MIC's result as the stage draws it: alpha over the input where the size
 *  is the same, over black where it isn't. */
export function composite(result: Planar, input: Picture): Picture {
  const rgba = toRgba(result, 1 / 255);
  const same = result.width === input.width && result.height === input.height;
  for (let i = 0; i < rgba.length; i += 4) {
    const a = Math.min(1, Math.max(0, rgba[i + 3]));
    if (a < 1) {
      for (let c = 0; c < 3; c++) rgba[i + c] = rgba[i + c] * a + (same ? input.rgba[i + c] * (1 - a) : 0);
    }
    rgba[i + 3] = 1;
  }
  return { rgba, width: result.width, height: result.height };
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** A result kept on the GPU, and what it was made from. */
interface Result {
  key: string;
  frame: string;
  upstream: string;
  area: Area;
  place: Area;
  sameSize: boolean;
  variant: string;
  bytes: number;
}

/** Results kept, so going back to one (a panel's eye let go, a slider moved
 *  back) shows it at once. */
const KEPT = 4;

export class PreviewController {
  private request: PreviewRequest | null = null;
  private shown: Result | null = null;
  /** Oldest first. */
  private kept: Result[] = [];
  private made = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  /** Bumped when the preview is turned off, so a run in flight is dropped. */
  private generation = 0;
  private stopped = false;
  private drawn = "";

  constructor(
    private readonly io: PreviewIO,
    private readonly limits: TextureLimits = CORE_LIMITS,
  ) {}

  /** What the stage draws, told only when it changes. */
  private view(mode: number, result: Result | null): void {
    const area = result?.area ?? FULL;
    const place = result?.place ?? FULL;
    const variant = mode === MODE_OFF ? null : (result?.variant ?? null);
    const drawn = mode === MODE_OFF ? "" : JSON.stringify([mode, area, place, variant]);
    if (drawn === this.drawn) return;
    this.drawn = drawn;
    this.io.view(mode, area, place, variant);
  }

  private hide(): void {
    this.view(MODE_OFF, null);
    this.shown = null;
  }

  private forgetAll(): void {
    this.hide();
    for (const r of this.kept) this.io.forget(r.variant);
    this.kept = [];
  }

  private show(result: Result): void {
    this.kept = [...this.kept.filter((r) => r !== result), result];
    this.shown = result;
    this.view(MODE_EXACT, result);
  }

  /** Lets go of the oldest results until `bytes` more fit what core holds. */
  private makeRoom(bytes: number): void {
    let held = this.kept.reduce((sum, r) => sum + r.bytes, 0);
    while (this.kept.length > 0 && held + bytes > this.limits.held) {
      const oldest = this.kept.shift()!;
      held -= oldest.bytes;
      this.io.forget(oldest.variant);
    }
  }

  private keep(result: Result): void {
    this.kept.push(result);
    while (this.kept.length > KEPT) this.io.forget(this.kept.shift()!.variant);
  }

  /** The latest state of the view, or null with nothing to preview. */
  update(request: PreviewRequest | null): void {
    if (this.stopped) return;
    if (!request || enabledSteps(request.stack).length === 0) {
      this.request = null;
      this.clearTimer();
      this.generation++;
      this.hide();
      this.io.status({ busy: false, error: null });
      return;
    }
    this.request = request;
    if (this.kept.length > 0 && this.kept[0].frame !== request.frame) this.forgetAll();
    const shown = this.shown;
    if (request.held) {
      this.clearTimer();
      if (shown?.sameSize) this.view(MODE_APPROX, shown);
      return;
    }
    const made = this.kept.find((r) => r.key === keyOf(request));
    if (made) {
      this.clearTimer();
      if (!this.running) this.show(made);
      return;
    }
    if (shown && shown.upstream !== request.upstream && shown.sameSize) this.view(MODE_APPROX, shown);
    this.schedule(this.io.delay);
  }

  dispose(): void {
    this.update(null);
    this.forgetAll();
    this.stopped = true;
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(delay: number): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.start();
    }, delay);
  }

  private async start(): Promise<void> {
    const request = this.request;
    if (this.running || !request || request.held) return;
    const key = keyOf(request);
    const made = this.kept.find((r) => r.key === key);
    if (made) return this.show(made);
    this.running = true;
    const generation = this.generation;
    this.io.status({ busy: true, error: null });
    try {
      const input = await this.io.capture(request.maxEdge);
      if (generation !== this.generation) return;
      if (!input) {
        this.io.status({ busy: false, error: null });
        return;
      }
      const result = await this.io.run(fromRgba(input.rgba, input.width, input.height, 255), request.stack, windowMap(input.area));
      if (generation !== this.generation) return;
      const resultBytes = bytesOf(result.width, result.height);
      const inputBytes = bytesOf(input.width, input.height);
      const bytes = resultBytes + inputBytes;
      if (Math.max(resultBytes, inputBytes) > this.limits.texture || bytes > this.limits.held) {
        throw new Error(`G'MIC's result, ${result.width} × ${result.height}, is too big to preview. Choose a smaller Preview size in Preferences ▸ G'MIC.`);
      }
      const sameSize = result.width === input.width && result.height === input.height;
      const place = sameSize ? FULL : placeIn(input.width / input.height, result.width, result.height);
      const variant = `r${++this.made}`;
      const picture = composite(result, input);
      this.makeRoom(bytes);
      this.io.upload(variant, picture, { rgba: input.rgba, width: input.width, height: input.height });
      const fresh: Result = { key, frame: request.frame, upstream: request.upstream, area: input.area, place, sameSize, variant, bytes };
      this.keep(fresh);
      this.shown = fresh;
      const current = this.request;
      const stale = current !== null && (current.held || (keyOf(current) !== key && current.upstream !== request.upstream)) && sameSize;
      this.view(stale ? MODE_APPROX : MODE_EXACT, fresh);
      this.io.status({ busy: false, error: null });
    } catch (e) {
      if (generation !== this.generation) return;
      this.hide();
      this.io.status({ busy: false, error: message(e) });
    } finally {
      this.running = false;
      const current = this.request;
      if (current && !current.held && generation === this.generation && keyOf(current) !== key) this.schedule(0);
      else if (current && !current.held && generation !== this.generation) this.schedule(this.io.delay);
    }
  }
}
