// The interactive filters Safelight draws itself, by their G'MIC command.
// Morph needs a second image, and Color Mask and Extract Foreground have no
// way to replay what was drawn, so they aren't here.

import type { Filter } from "../gmic/catalogue";
import { CurvesEditor } from "./CurvesEditor";
import type { InteractiveEditor } from "./editors";
import { COLOR_SPACE, INPUT_TYPE, colorizeJob, curvesJob, warpJob } from "./models";
import { pointsCanvas, pointsPanel } from "./PointsEditor";

const EDITORS: readonly InteractiveEditor[] = [
  {
    command: "fx_curves_interactive",
    settings: [COLOR_SPACE],
    job: (_filter, values, data) => curvesJob(values, data),
    Panel: CurvesEditor,
  },
  {
    command: "fx_warp_interactive",
    settings: [],
    job: (_filter, _values, data, map) => warpJob(data, map),
    Panel: pointsPanel("warp"),
    Canvas: pointsCanvas("warp"),
  },
  {
    command: "fx_colorize_interactive",
    settings: [INPUT_TYPE],
    job: (_filter, values, data, map) => colorizeJob(values, data, map),
    Panel: pointsPanel("colour"),
    Canvas: pointsCanvas("colour"),
  },
];

const BY_COMMAND = new Map(EDITORS.map((e) => [e.command, e]));

export function editorFor(command: string): InteractiveEditor | undefined {
  return BY_COMMAND.get(command);
}

/** Whether a filter can run here: an interactive one needs an editor. */
export function isAvailable(filter: Filter): boolean {
  return !filter.interactive || BY_COMMAND.has(filter.command);
}
