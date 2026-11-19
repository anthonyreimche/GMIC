// State the extension's views share: the installed list (from settings), the
// filter list G'MIC reads, the preview's status, and the panel last touched,
// whose points the canvas shows.

import { React, api } from "./rt";
import type { CommandDeps } from "./command";
import { NeedsUpdateError } from "./gmic/engine";
import type { Catalogue } from "./gmic/catalogue";
import type { PreviewStatus } from "./preview";
import { INSTALLED, readInstalled, writeInstalled, type Item } from "./stack";
import type { AppStore } from "./safelight";

export interface Shared {
  status: PreviewStatus;
  /** The item whose panel was touched last. */
  focus: string | null;
  catalogue: Catalogue | null;
  /** Why there is no filter list: G'MIC's update isn't downloaded, or an error. */
  problem: { needsUpdate: boolean; text: string } | null;
  loading: boolean;
  /** The store's open tab, and the script it shows. */
  storeTab: StoreTab;
  storeScript: string | null;
  /** The item whose points a press on the photo places, if any. */
  placing: string | null;
  /** The colour Colorize places, 0–255. */
  brush: number[];
}

export type StoreTab = "filters" | "scripts" | "installed";

export const STORE_ID = "gmic.store";

let store: AppStore<Shared> | null = null;

let boundDeps: CommandDeps | null = null;

/** A fresh state for a fresh activation, reading filters through `deps`. */
export function resetShared(deps: CommandDeps): void {
  store = null;
  boundDeps = deps;
}

/** Starts reading G'MIC's filter list unless it is read, being read, or failed. */
export function ensureCatalogue(): void {
  const { catalogue, loading, problem } = shared().getState();
  if (boundDeps && !catalogue && !loading && !problem) void loadCatalogue(boundDeps);
}

export function shared(): AppStore<Shared> {
  store ??= api.stores.create<Shared>()(() => ({
    status: { busy: false, error: null },
    focus: null,
    catalogue: null,
    problem: null,
    loading: false,
    storeTab: "filters",
    storeScript: null,
    placing: null,
    brush: [220, 120, 60],
  }));
  return store;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Reads G'MIC's filter list (downloading G'MIC's update first with
 *  `update`) into the shared state. */
export async function loadCatalogue(deps: CommandDeps, update = false): Promise<Catalogue | null> {
  const s = shared();
  s.setState({ loading: true, problem: null });
  try {
    const catalogue = update ? await deps.engine.update() : await deps.engine.catalogue();
    s.setState({ catalogue, loading: false });
    return catalogue;
  } catch (e) {
    s.setState({ catalogue: null, loading: false, problem: { needsUpdate: e instanceof NeedsUpdateError, text: message(e) } });
    return null;
  }
}

export function useShared<T>(select: (s: Shared) => T): T {
  return shared()(select);
}

export function useInstalled(): Item[] {
  const [items, setItems] = React.useState<Item[]>(() => readInstalled(api.settings));
  React.useEffect(
    () =>
      api.settings.onChange((key) => {
        if (key === INSTALLED) setItems(readInstalled(api.settings));
      }),
    [],
  );
  return items;
}

export function saveInstalled(items: readonly Item[]): void {
  writeInstalled(api.settings, items);
}

/** Shows the G'MIC store's window at `tab`. */
export function openStore(tab: StoreTab, script: string | null = null): void {
  shared().setState({ storeTab: tab, storeScript: script });
  api.windows.open(STORE_ID);
}
