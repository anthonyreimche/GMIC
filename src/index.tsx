// The entry point. Safelight imports dist/index.js (built from this file) and
// calls activate() once with the API, scoped to this extension.

import { React, initRuntime } from "./rt";
import { gmicCommand, type CommandDeps } from "./command";
import { createEngine } from "./gmic/engine";
import { exportProcessor } from "./export";
import { GmicOverlay } from "./Overlay";
import { panelSync } from "./panels";
import { GmicPreferences } from "./Prefs";
import { renderPng, renderSize } from "./render";
import { LEGACY_SCRIPTS, readLegacyScripts } from "./scripts";
import { GmicStore } from "./Store";
import { previewStage } from "./stage";
import { INSTALLED, installScript, readInstalled, writeInstalled, type ScriptItem } from "./stack";
import { STORE_ID, resetShared } from "./state";
import type { SafelightAPI } from "./safelight";

export const STORE_BUTTON = "gmic.store-button";

export const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="black" d="M3 2h10a1 1 0 0 1 1 1v3h-1.5V3.5h-9v9h9V10H8V8.5h6V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"/><circle cx="8" cy="8" r="1.6" fill="black"/></svg>`;

export function createDeps(host: SafelightAPI): CommandDeps {
  return {
    engine: createEngine(host.programs),
    scripts: () => readInstalled(host.settings).filter((i): i is ScriptItem => i.kind === "script"),
    render: (photo, signal) => renderPng(host, photo, { longEdge: renderSize(host.settings), bits: 16, signal }),
    displayName: (photo) => host.catalog.photoDisplayName(photo),
  };
}

/** Scripts saved by G'MIC 1.0 become installed scripts, once. */
function migrateScripts(host: SafelightAPI): void {
  const legacy = readLegacyScripts(host.settings);
  if (legacy.length === 0) return;
  let items = readInstalled(host.settings);
  for (const s of legacy) items = installScript(items, s.name, s.source);
  writeInstalled(host.settings, items);
  host.settings.set(LEGACY_SCRIPTS, null);
}

export function activate(host: SafelightAPI): void {
  initRuntime(host);
  migrateScripts(host);
  const deps = createDeps(host);
  resetShared(deps);

  host.registerProcessingStage(previewStage());
  host.registerExportProcessor(
    exportProcessor({
      installed: () => readInstalled(host.settings),
      editState: (id) => host.catalog.getEditState(id),
      catalogue: () => deps.engine.catalogue(),
      runStack: (input, jobs, options) => deps.engine.runStack(input, jobs, options),
    }),
  );
  host.commands.register(gmicCommand(deps));
  host.registerSettings({ title: "G'MIC", fields: [], component: () => <GmicPreferences deps={deps} />, keywords: ["gmic", "g'mic", "filters", "scripts"] });
  host.registerWindow({ id: STORE_ID, title: "G'MIC store", component: () => <GmicStore deps={deps} />, maximizable: true });
  host.registerTopBarButton({
    id: STORE_BUTTON,
    label: "G'MIC store",
    svg: ICON,
    onClick: () => host.windows.toggle(STORE_ID),
  });
  host.registerSlot({ id: "gmic.canvas", slot: "develop-canvas-overlay", component: () => <GmicOverlay deps={deps} /> });

  const panels = panelSync(host);
  panels.sync(readInstalled(host.settings), false);
  host.settings.onChange((key) => {
    if (key === INSTALLED) panels.sync(readInstalled(host.settings), true);
  });
}
