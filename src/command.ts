// The `gmic` command: the same words in the Terminal's console and in the
// `safelight` command line.

import type { GmicEngine } from "./gmic/engine";
import { NotSetUpError } from "./gmic/engine";
import { isSettable } from "./gmic/params";
import { searchFilters } from "./gmic/catalogue";
import { scriptParams, type Job } from "./gmic/script";
import { SUBCOMMANDS, USAGE, parseWords } from "./gmic/words";
import { namedFilterJob, namedScriptJob } from "./jobs";
import type { Script } from "./scripts";
import type { CatalogPhoto, CommandContribution, CommandRunContext } from "./safelight";

export interface CommandDeps {
  engine: GmicEngine;
  scripts(): Script[];
  /** The photo as a PNG, the way G'MIC gets it. */
  render(photo: CatalogPhoto, signal: AbortSignal): Promise<Uint8Array>;
  displayName(photo: CatalogPhoto): string;
}

export const SUFFIX = "gmic";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/** Runs `job` on each photo, saving what G'MIC leaves beside it. A photo that
 *  fails is reported and the rest go on; it fails only when every photo does. */
export async function applyToPhotos(deps: CommandDeps, ctx: CommandRunContext, job: Job): Promise<void> {
  const { photos } = ctx;
  if (photos.length === 0) {
    throw new Error(
      ctx.caller === "cli"
        ? "No photo to run on: open one, or name photos after --."
        : "No photo to run on: open one in Develop, or select some in the Library.",
    );
  }
  for (const photo of photos) {
    const reason = await ctx.canSaveBeside(photo);
    if (reason) throw new Error(`${deps.displayName(photo)}: ${reason}`);
  }
  if (!(await deps.engine.program())) throw new NotSetUpError();

  const saved: string[] = [];
  const failed: { photo: string; error: string }[] = [];
  for (const [i, photo] of photos.entries()) {
    ctx.signal.throwIfAborted();
    const name = deps.displayName(photo);
    const count = photos.length > 1 ? ` (${i + 1} of ${photos.length})` : "";
    const line = ctx.progress(`${name}${count}: rendering`);
    try {
      const input = await deps.render(photo, ctx.signal);
      line.update(`${name}${count}: running G'MIC`);
      const outputs = await deps.engine.run(input, job, { signal: ctx.signal });
      const names: string[] = [];
      for (const out of outputs) {
        names.push(await ctx.saveBeside(photo, new Blob([new Uint8Array(out)], { type: "image/png" }), SUFFIX, "png"));
      }
      saved.push(...names);
      line.done(`${name} → ${names.join(", ")}`);
    } catch (e) {
      line.done();
      if (isAbort(e) || ctx.signal.aborted) throw e;
      failed.push({ photo: name, error: message(e) });
      ctx.warn(`${name}: ${message(e)}`);
    }
  }
  ctx.result({ saved, failed });
  if (failed.length === photos.length) {
    throw new Error(failed.length === 1 ? failed[0].error : `G'MIC failed on every photo. The first: ${failed[0].error}`);
  }
}

export function gmicCommand(deps: CommandDeps): CommandContribution {
  return {
    name: "gmic",
    summary: "Run G'MIC filters and scripts on photos, each result saved beside its photo",
    usage: [...USAGE],
    examples: ["gmic blur 3 sharpen 50", "gmic filters sharpen", 'gmic filter "Sharpen [Unsharp Mask]" radius=2', "gmic script Soft Glow strength=0.4"],
    subcommands: SUBCOMMANDS.map((s) => ({ ...s })),
    async run(ctx) {
      const action = parseWords(ctx.words);
      switch (action.kind) {
        case "usage":
          for (const line of USAGE) ctx.print(line);
          return;
        case "status": {
          const program = await deps.engine.program();
          if (!program) throw new NotSetUpError();
          ctx.print(`G'MIC ${await deps.engine.version()}: ${program.path}`);
          return;
        }
        case "update": {
          const line = ctx.progress("Downloading G'MIC's filter definitions");
          try {
            const catalogue = await deps.engine.update({ signal: ctx.signal });
            const count = catalogue.categories.reduce((n, c) => n + c.filters.length, 0);
            ctx.print(`G'MIC's filters are up to date: ${count} filters.`);
          } finally {
            line.done();
          }
          return;
        }
        case "help":
          if (!action.topic) {
            for (const line of USAGE) ctx.print(line);
            return;
          }
          ctx.print(await deps.engine.help(action.topic));
          return;
        case "filters": {
          const found = searchFilters(await deps.engine.catalogue({ signal: ctx.signal }), action.search);
          if (found.length === 0) ctx.info(action.search ? `No filter matches "${action.search}".` : "G'MIC lists no filters.");
          for (const f of found) ctx.print(`${f.category} › ${f.name}   ${f.command}`);
          ctx.result(found.map((f) => ({ category: f.category, name: f.name, command: f.command })));
          return;
        }
        case "scripts": {
          const scripts = deps.scripts();
          if (scripts.length === 0) ctx.info("No scripts yet. Write one in the G'MIC store's Scripts tab.");
          for (const s of scripts) {
            const names = scriptParams(s.source).filter(isSettable).map((p) => p.name);
            ctx.print(names.length > 0 ? `${s.name}   ${names.join(", ")}` : s.name);
          }
          ctx.result(scripts.map((s) => ({ name: s.name })));
          return;
        }
        case "pipeline":
          return applyToPhotos(deps, ctx, { kind: "line", line: action.line });
        case "filter":
          return applyToPhotos(deps, ctx, namedFilterJob(await deps.engine.catalogue({ signal: ctx.signal }), action.name, action.assignments));
        case "script":
          return applyToPhotos(deps, ctx, namedScriptJob(deps.scripts(), action.name, action.source, action.assignments));
      }
    },
  };
}
