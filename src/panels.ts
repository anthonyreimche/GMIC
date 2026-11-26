// Each installed filter or script is a Develop panel of its own: registered
// as it is installed (and opened, so it shows up), renamed as it is, and taken
// away as it is removed (closed first, or the dock keeps its spot with a
// note). Its preview eye holds off only its own key.

import { React } from "./rt";
import { FilterPanel, resetItem } from "./FilterPanel";
import { itemKey, type Item } from "./stack";
import type { SafelightAPI } from "./safelight";

type Host = Pick<SafelightAPI, "registerPanel" | "unregisterPanel" | "dock">;

export interface PanelSync {
  /** Brings the panels in line with `items`; `openNew` opens those new since
   *  the last call. */
  sync(items: readonly Item[], openNew: boolean): void;
}

export function panelSync(host: Host): PanelSync {
  const shown = new Map<string, string>();
  return {
    sync(items, openNew) {
      const ids = new Set(items.map((i) => i.id));
      for (const [id] of shown) {
        if (ids.has(id)) continue;
        if (host.dock.isPanelOpen(itemKey(id))) host.dock.togglePanel(itemKey(id));
        host.unregisterPanel(itemKey(id));
        shown.delete(id);
      }
      items.forEach((item, index) => {
        const known = shown.get(item.id);
        if (known === item.name) return;
        host.registerPanel({
          id: itemKey(item.id),
          title: item.name,
          component: () => React.createElement(FilterPanel, { id: item.id }),
          order: 200 + index,
          defaultDock: { module: "develop", direction: "right" },
          modules: ["develop"],
          onReset: () => resetItem(item),
          ownsBag: [itemKey(item.id)],
        });
        shown.set(item.id, item.name);
        if (known === undefined && openNew && !host.dock.isPanelOpen(itemKey(item.id))) host.dock.togglePanel(itemKey(item.id));
      });
    },
  };
}
