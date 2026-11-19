// Editors for G'MIC's interactive filters. In G'MIC-Qt, Curves, Colorize and
// Warp open G'MIC's own window to draw in; here the drawing happens in Develop
// (the filter's panel, or over the photo) and is kept with the photo's edit as
// the item's `data`. Each editor turns that data into a G'MIC job that applies
// it with no window, for the preview and the export alike.

import type { ComponentType } from "react";
import type { Filter } from "../gmic/catalogue";
import type { ParamValues } from "../gmic/params";
import type { Job } from "../gmic/script";
import type { OverlayRect } from "../safelight";

/** Moves a point, in % of the image G'MIC is given. */
export type PointMap = (point: number[]) => number[];

export interface EditorProps {
  /** The installed item's id. */
  id: string;
  name: string;
  filter: Filter;
  /** The filter's settings, at their defaults where the photo has none. */
  values: ParamValues;
  /** What was drawn, as this editor keeps it; undefined before any drawing. */
  data: unknown;
  /** Writes what was drawn, live: the preview follows. */
  setData(data: unknown): void;
  /** Ends a gesture as one undo step. */
  commit(label: string): void;
}

export interface CanvasEditorProps extends EditorProps {
  /** The photo's frame on the canvas, in the overlay's coordinates. */
  image: OverlayRect;
}

export interface InteractiveEditor {
  /** The filter's own command, which would open G'MIC's window. */
  command: string;
  /** The filter's settings its panel shows, by name: the rest are G'MIC
   *  window's own (view size, palettes) or what the editor draws. */
  settings: readonly string[];
  /** The job that applies `data` with no window. `map` moves points from the
   *  frame to the part of it G'MIC is given (a zoomed preview's window). */
  job(filter: Filter, values: ParamValues, data: unknown, map?: PointMap): Job;
  /** Drawn in the filter's panel. */
  Panel?: ComponentType<EditorProps>;
  /** Drawn over the photo while the filter's panel was touched last. */
  Canvas?: ComponentType<CanvasEditorProps>;
}
