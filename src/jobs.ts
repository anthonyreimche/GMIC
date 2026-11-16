// Turning a filter or a script, with its settings, into a job for G'MIC.

import type { Catalogue, Filter } from "./gmic/catalogue";
import { findFilter } from "./gmic/catalogue";
import { argList, valuesFromAssignments, type ParamValues } from "./gmic/params";
import { scriptParams, type Job } from "./gmic/script";
import { findScript, type Script } from "./scripts";

export function filterJob(filter: Filter, values: ParamValues): Job {
  const args = argList(filter.params, values);
  return { kind: "line", line: args ? `${filter.command} ${args}` : filter.command };
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
