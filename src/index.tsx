// The entry point. Safelight imports dist/index.js (built from this file) and
// calls activate() once with the API, scoped to this extension.

import { React, initRuntime } from "./rt";
import { gmicCommand, type CommandDeps } from "./command";
import { createEngine } from "./gmic/engine";
import { GmicPanel } from "./GmicPanel";
import { renderPng, renderSize } from "./render";
import { readScripts } from "./scripts";
import type { SafelightAPI } from "./safelight";

export const PANEL_ID = "gmic.panel";

export function createDeps(host: SafelightAPI): CommandDeps {
  return {
    engine: createEngine(host.programs),
    scripts: () => readScripts(host.settings),
    render: (photo, signal) => renderPng(host, photo, { longEdge: renderSize(host.settings), bits: 16, signal }),
    displayName: (photo) => host.catalog.photoDisplayName(photo),
  };
}

export function activate(host: SafelightAPI): void {
  initRuntime(host);
  const deps = createDeps(host);
  host.commands.register(gmicCommand(deps));
  host.registerPanel({
    id: PANEL_ID,
    title: "G'MIC",
    component: () => <GmicPanel deps={deps} />,
    defaultDock: { module: "develop", direction: "right" },
  });
}
