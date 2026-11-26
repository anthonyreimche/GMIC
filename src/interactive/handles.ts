// What the points drawn on the photo share: how a handle looks, and where the
// pointer is in the photo's own percent.

import type { CSSProperties } from "react";
import { api } from "../rt";
import type { OverlayRect } from "../safelight";

export function handleStyle(size: number): CSSProperties {
  return {
    position: "absolute",
    width: size,
    height: size,
    marginLeft: -size / 2,
    marginTop: -size / 2,
    borderRadius: "50%",
    border: "2px solid white",
    boxShadow: "0 0 0 1px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5)",
    pointerEvents: "auto",
    touchAction: "none",
    cursor: api.cursors.resolve("crop-move"),
  };
}

/** The pointer over the photo `image` in `el`'s layout px, as % of the photo, held to `limits`. */
export function percentAt(
  el: Element,
  e: { clientX: number; clientY: number },
  image: OverlayRect,
  limits: readonly [number, number],
): [number, number] {
  const p = api.develop.framePoint(el, e.clientX, e.clientY);
  const held = (v: number) => Math.min(limits[1], Math.max(limits[0], v));
  return [held(((p.x - image.x) / image.w) * 100), held(((p.y - image.y) / image.h) * 100)];
}
