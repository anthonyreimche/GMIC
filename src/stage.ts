// The stage that shows G'MIC's preview in Develop. It is view-only: exports,
// thumbnails and captures never draw it, so the preview's capture never sees
// its own result, and the export applies the stack itself (export.ts).
//
// It runs last, on the display-encoded colour an sRGB export holds before
// encoding. `viewUv` is the point in the frame, 0 to 1 from its top left,
// whatever the zoom; `area` is the part of the frame the textures were made
// from (the window a zoomed view showed), and `place` where G'MIC's result
// sits inside it (all of it, unless G'MIC changed the size). Mode 1 shows the
// result; mode 2, while the edit upstream has changed since, adds the result's
// difference from its input to the live colour, so other sliders still move
// the image until the fresh result lands.
//
// Every picture handed over carries READY_ALPHA as its alpha. Core draws a
// texture it holds no data for (not posted yet, or refused) as opaque black,
// alpha 1: the stage then leaves the live colour as it is, never that black.

import { STAGE_ID } from "./stack";
import type { ProcessingStageContribution, StageTextureData } from "./safelight";

export const MODE_OFF = 0;
export const MODE_EXACT = 1;
export const MODE_APPROX = 2;

export const qualified = (key: string) => `${STAGE_ID}.${key}`;

export const READY_ALPHA = 2;

const GLSL = `
if (mode > 0) {
  vec2 t = (viewUv - area.xy) / area.zw;
  bool ready = texture(gmicOut, vec2(0.5)).a > ${READY_ALPHA - 0.5} && (mode == 1 || texture(gmicIn, vec2(0.5)).a > ${READY_ALPHA - 0.5});
  if (ready && t.x >= 0.0 && t.y >= 0.0 && t.x <= 1.0 && t.y <= 1.0) {
    vec2 r = (t - place.xy) / place.zw;
    bool inside = r.x >= 0.0 && r.y >= 0.0 && r.x <= 1.0 && r.y <= 1.0;
    vec3 shown = inside ? texture(gmicOut, r).rgb : vec3(0.0);
    c = mode == 2 ? c + (shown - texture(gmicIn, t).rgb) : shown;
  }
}`;

export function previewStage(): ProcessingStageContribution {
  return {
    id: STAGE_ID,
    name: "G'MIC",
    phase: "output-encode",
    priority: 100000,
    viewOnly: true,
    space: { encoding: "perceptual", primaries: "rec709" },
    uniforms: [
      { key: "mode", glslType: "int", default: MODE_OFF },
      { key: "area", glslType: "vec4", default: [0, 0, 1, 1] },
      { key: "place", glslType: "vec4", default: [0, 0, 1, 1] },
    ],
    textures: [
      { key: "gmicOut", kind: "dynamic", format: "rgba16f" },
      { key: "gmicIn", kind: "dynamic", format: "rgba16f" },
    ],
    dormantWhen: { mode: MODE_OFF },
    glsl: GLSL,
  };
}

/** RGBA floats as a stage texture, their alpha set to READY_ALPHA. */
export function texture(rgba: Float32Array, width: number, height: number, version: number): StageTextureData {
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = READY_ALPHA;
  return { data: rgba, width, height, format: "rgba16f", version };
}
