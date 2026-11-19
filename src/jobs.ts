// Turning a filter or a script, with its settings, into a job for G'MIC.

import type { Catalogue, Filter } from "./gmic/catalogue";
import { filterByCommand, findFilter } from "./gmic/catalogue";
import { argList, defaultsOf, isSettable, valuesFromAssignments, type Param, type ParamValue, type ParamValues, type SettableParam } from "./gmic/params";
import { scriptParams, type Job } from "./gmic/script";
import { findScript, type Script } from "./scripts";
import { enabledSteps, type Item, type Stack } from "./stack";
import { editorFor } from "./interactive";

export function filterJob(filter: Filter, values: ParamValues, command = filter.command): Job {
  const args = argList(filter.params, values);
  return { kind: "line", line: args ? `${command} ${args}` : command };
}



export function scriptJob(source: string, values: ParamValues): Job {
  return { kind: "script", source, args: argList(scriptParams(source), values) };
}

export function namedFilterJob(catalogue: Catalogue, name: string, assignments: readonly string[]): Job {
  const filter = findFilter(catalogue, name);
  if (!filter) throw new Error(`No filter "${name}". gmic filters <words> searches them.`);
  return filterJob(filter, valuesFromAssignments(filter.params, assignments));
}

export function namedScriptJob(scripts: readonly Script[], name: string | null, source: string | null, assignments: readonly string[]): Job {
  let text = source;
  if (text === null) {
    const script = findScript(scripts, name ?? "");
    if (!script) throw new Error(`No script "${name}". gmic scripts lists them.`);
    text = script.source;
  }
  return scriptJob(text, valuesFromAssignments(scriptParams(text), assignments));
}

/** A step's settings: its filter's, from the list, or its script's own. */
export function stepParams(step: Item, catalogue: Catalogue | null): Param[] {
  if (step.kind === "script") return scriptParams(step.source);
  return (catalogue && filterByCommand(catalogue, step.command)?.params) || [];
}

const isNumbers = (v: unknown, length?: number): v is number[] =>
  Array.isArray(v) && v.every((n) => typeof n === "number" && Number.isFinite(n)) && (length === undefined || v.length === length);

function fits(p: SettableParam, v: ParamValue | undefined): boolean {
  switch (p.kind) {
    case "float":
    case "int":
    case "choice":
      return typeof v === "number" && Number.isFinite(v);
    case "bool":
      return typeof v === "boolean";
    case "text":
      return typeof v === "string";
    case "color":
      return isNumbers(v) && v.length >= 3;
    case "point":
      return isNumbers(v, 2);
  }
}

/** The defaults, with each stored value that still fits its setting. */
export function stepValues(params: readonly Param[], stored: ParamValues): ParamValues {
  const values = defaultsOf(params);
  for (const p of params) if (isSettable(p) && fits(p, stored[p.name])) values[p.name] = stored[p.name];
  return values;
}

export type { PointMap } from "./interactive/editors";
import type { PointMap } from "./interactive/editors";

function mapPoints(params: readonly Param[], values: ParamValues, map: PointMap | undefined): ParamValues {
  if (!map) return values;
  const out = { ...values };
  for (const p of params) if (p.kind === "point" && isNumbers(out[p.name], 2)) out[p.name] = map(out[p.name] as number[]);
  return out;
}

/** The jobs a stack's enabled steps make, in order. `map` moves points from
 *  the frame to the part of it G'MIC is given (a zoomed preview's window). */
export function stepJobs(stack: Stack, catalogue: Catalogue | null, map?: PointMap): Job[] {
  return enabledSteps(stack).map((step) => {
    if (step.kind === "script") {
      const params = scriptParams(step.source);
      return { kind: "script", source: step.source, args: argList(params, mapPoints(params, stepValues(params, step.values), map)) };
    }
    if (!catalogue) throw new Error("G'MIC's filter list isn't loaded.");
    const filter = filterByCommand(catalogue, step.command);
    if (!filter) throw new Error(`This G'MIC has no "${step.name}" filter. Update G'MIC's filters in Preferences.`);
    const values = stepValues(filter.params, step.values);
    if (filter.interactive) {
      const editor = editorFor(filter.command);
      if (!editor) throw new Error(`"${filter.name}" only works in G'MIC's own window, which Safelight doesn't open.`);
      return editor.job(filter, values, step.data, map);
    }
    return filterJob(filter, mapPoints(filter.params, values, map));
  });
}
