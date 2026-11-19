// Export: the photo's G'MIC look applied to the exported pixels at their own
// size, so pixel-sized settings act at true scale. The live view's stage never
// draws in an export (it is view-only); this is where the look is made.

import { fromRgba, type Planar } from "./gmic/cimg";
import type { Catalogue } from "./gmic/catalogue";
import type { StackRunOptions } from "./gmic/engine";
import { gmicVars, type Job } from "./gmic/script";
import { stepJobs } from "./jobs";
import { composite } from "./preview";
import { photoSteps, type Item } from "./stack";
import type { EditState, ExportFrame, ExportProcessorContribution } from "./safelight";

export interface ExportDeps {
  installed(): Item[];
  editState(photoId: string): Promise<EditState | null>;
  catalogue(): Promise<Catalogue>;
  runStack(input: Planar, jobs: readonly Job[], options?: StackRunOptions): Promise<Planar>;
}

const MAX = 65535;

/** The bag at the edit's cursor, as Develop and Export open it. */
function savedBag(edit: EditState | null): Record<string, unknown> | null {
  if (!edit || edit.stack.length === 0) return null;
  const index = typeof edit.currentIndex === "number" ? Math.trunc(edit.currentIndex) : NaN;
  const at = Number.isNaN(index) ? edit.stack.length - 1 : Math.min(Math.max(index, 0), edit.stack.length - 1);
  return edit.stack[at].paramBag ?? null;
}

export function exportProcessor(deps: ExportDeps): ExportProcessorContribution {
  return {
    id: "gmic.export",
    label: "G'MIC",
    settings: [{ key: "enabled", label: "Apply G'MIC filters", hint: "Each photo's G'MIC panels, as it shows them in Develop.", type: "boolean", default: true }],
    async processPixels(frame, photo, settings): Promise<ExportFrame | void> {
      if (settings.enabled === false) return;
      const steps = photoSteps(deps.installed(), savedBag(await deps.editState(photo.id)));
      if (steps.length === 0) return;
      const catalogue = steps.some((s) => s.kind === "filter") ? await deps.catalogue() : null;
      const jobs = stepJobs(steps, catalogue);
      const { width, height } = frame;
      const input = fromRgba(frame.data, width, height, 255 / MAX);
      const result = await deps.runStack(input, jobs, { vars: gmicVars(width, height) });
      const rgba = new Float32Array(frame.data.length);
      for (let i = 0; i < rgba.length; i++) rgba[i] = frame.data[i] / MAX;
      const shown = composite(result, { rgba, width, height });
      const data = new Uint16Array(shown.rgba.length);
      for (let i = 0; i < data.length; i++) data[i] = Math.round(Math.min(1, Math.max(0, shown.rgba[i])) * MAX);
      return { ...frame, data, width: shown.width, height: shown.height };
    },
  };
}
