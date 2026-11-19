// The G'MIC store: G'MIC's filters to install as Develop panels, your own
// scripts, and the installed ones in the order they apply.

import { React, api } from "./rt";
import type { CommandDeps } from "./command";
import { searchFilters, type Filter } from "./gmic/catalogue";
import { scriptParams } from "./gmic/script";
import { isSettable } from "./gmic/params";
import { ProgramSection, useProgram } from "./Setup";
import { NEW_SCRIPT } from "./scripts";
import { isAvailable } from "./interactive";
import { installFilter, installScript, moveItem, uninstall, updateScript, type Item, type ScriptItem } from "./stack";
import { ensureCatalogue, loadCatalogue, saveInstalled, shared, useInstalled, useShared, type StoreTab } from "./state";

const MAX_LISTED = 150;
const ALL = "";
const muted = { margin: 0, fontSize: 11, opacity: 0.7 } as const;

function freeName(items: readonly Item[], base: string, except?: string): string {
  const taken = (name: string) => items.some((i) => i.id !== except && i.kind === "script" && i.name.trim().toLowerCase() === name.toLowerCase());
  if (!taken(base)) return base;
  for (let n = 2; ; n++) if (!taken(`${base} ${n}`)) return `${base} ${n}`;
}

/** The top level of each filter category: the store's sidebar. */
function topCategories(catalogue: { categories: { name: string }[] }): string[] {
  return [...new Set(catalogue.categories.map((c) => c.name.split(" › ")[0]))];
}

function FiltersTab(props: { items: Item[]; category: string }) {
  const ui = api.ui;
  const catalogue = useShared((s) => s.catalogue);
  const [search, setSearch] = React.useState("");
  const { category } = props;
  const found = React.useMemo(
    () => (catalogue ? searchFilters(catalogue, search).filter((f) => category === ALL || f.category === category || f.category.startsWith(`${category} › `)) : []),
    [catalogue, search, category],
  );
  if (!catalogue) return null;
  const installedAs = (f: Filter) => props.items.find((i) => i.kind === "filter" && i.command === f.command);

  return (
    <ui.Stack gap={6}>
      <ui.TextInput value={search} placeholder={category === ALL ? "Search filters" : `Search ${category}`} aria-label="Search filters" onChange={setSearch} />
      <p style={muted}>{found.length === 1 ? "1 filter" : `${found.length} filters`}</p>
      <div role="list" aria-label="Filters" style={{ display: "grid", gap: 2 }}>
        {found.slice(0, MAX_LISTED).map((f) => {
          const item = installedAs(f);
          return (
            <div key={`${f.category}/${f.command}`} role="listitem" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12 }} title={`${f.category} › ${f.name}`}>
                {f.name}
                <span style={{ ...muted, marginLeft: 6 }}>{f.category}</span>
              </span>
              {item ? (
                <ui.Button size="sm" variant="ghost" aria-label={`Remove ${f.name}`} onClick={() => saveInstalled(uninstall(props.items, item.id))}>
                  Remove
                </ui.Button>
              ) : !isAvailable(f) ? (
                <span style={muted} title="It only works in G'MIC's own window, which Safelight doesn't open.">
                  Not available
                </span>
              ) : (
                <ui.Button size="sm" aria-label={`Install ${f.name}`} onClick={() => saveInstalled(installFilter(props.items, f))}>
                  Install
                </ui.Button>
              )}
            </div>
          );
        })}
      </div>
      {found.length > MAX_LISTED && <p style={muted}>{found.length - MAX_LISTED} more: narrow the search.</p>}
    </ui.Stack>
  );
}

function ScriptsTab(props: { items: Item[] }) {
  const ui = api.ui;
  const scripts = props.items.filter((i): i is ScriptItem => i.kind === "script");
  const asked = useShared((s) => s.storeScript);
  const [selectedId, setSelectedId] = React.useState<string | null>(asked ?? scripts[0]?.id ?? null);
  React.useEffect(() => {
    if (asked) setSelectedId(asked);
  }, [asked]);
  const selected = scripts.find((s) => s.id === selectedId) ?? null;
  const settings = selected ? scriptParams(selected.source).filter(isSettable).map((p) => p.name) : [];

  const add = () => {
    const next = installScript(props.items, freeName(props.items, "New script"), NEW_SCRIPT);
    saveInstalled(next);
    setSelectedId(next[next.length - 1].id);
  };
  const update = (patch: Partial<Pick<ScriptItem, "name" | "source">>) => selected && saveInstalled(updateScript(props.items, selected.id, patch));

  return (
    <ui.Stack gap={8}>
      <ui.Row gap={6}>
        {scripts.length > 0 && (
          <ui.Select ariaLabel="Script" value={selected?.id ?? ""} options={scripts.map((s) => ({ value: s.id, label: s.name }))} onChange={setSelectedId} />
        )}
        <ui.Button size="sm" onClick={add}>
          New script
        </ui.Button>
        {selected && (
          <ui.Button size="sm" variant="ghost" onClick={() => saveInstalled(uninstall(props.items, selected.id))}>
            Delete
          </ui.Button>
        )}
      </ui.Row>
      {!selected && (
        <p style={muted}>
          A script is G'MIC words run on the photo, each script a Develop panel of its own. #@gui lines give it settings, as G'MIC-Qt's filters have; they reach it as $1, $2 and on.
        </p>
      )}
      {selected && (
        <>
          <ui.Field label="Name">
            <ui.TextInput
              aria-label="Script name"
              value={selected.name}
              onChange={(name) => update({ name })}
              onBlur={() => update({ name: freeName(props.items, selected.name.trim() || "Script", selected.id) })}
            />
          </ui.Field>
          <ui.TextArea mono rows={20} aria-label="Script source" spellCheck={false} value={selected.source} onChange={(source) => update({ source })} />
          <p style={muted}>{settings.length > 0 ? `Settings: ${settings.join(", ")}.` : "No settings."} Changes show in Develop as you type.</p>
        </>
      )}
    </ui.Stack>
  );
}

const rowStyle = { display: "flex", alignItems: "center", gap: 6, padding: "2px 0" } as const;
const gripStyle = { cursor: "grab", touchAction: "none", padding: "0 4px", opacity: 0.6, userSelect: "none" } as const;

function InstalledTab(props: { items: Item[] }) {
  const ui = api.ui;
  const list = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState<{ id: string; to: number } | null>(null);
  const move = (id: string, to: number) => saveInstalled(moveItem(props.items, id, to));

  const indexAt = (clientY: number): number => {
    const rows = [...(list.current?.querySelectorAll<HTMLElement>("[data-row]") ?? [])];
    const at = rows.findIndex((r) => {
      const box = r.getBoundingClientRect();
      return clientY < box.top + box.height / 2;
    });
    return at < 0 ? rows.length - 1 : at;
  };

  if (props.items.length === 0) return <p style={muted}>Nothing installed yet. Install filters, or write a script, and each becomes a Develop panel.</p>;
  return (
    <ui.Stack gap={6}>
      <p style={muted}>They apply in this order, top first. Drag to reorder.</p>
      <div ref={list} role="list" aria-label="Installed">
        {props.items.map((item, i) => (
          <div key={item.id} data-row role="listitem" style={{ ...rowStyle, opacity: dragging?.id === item.id ? 0.5 : 1 }}>
            <span
              aria-hidden
              style={gripStyle}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragging({ id: item.id, to: i });
              }}
              onPointerMove={(e) => dragging?.id === item.id && setDragging({ id: item.id, to: indexAt(e.clientY) })}
              onPointerUp={() => {
                if (dragging?.id === item.id && dragging.to !== i) move(item.id, dragging.to > i ? dragging.to - 1 : dragging.to);
                setDragging(null);
              }}
              onPointerCancel={() => setDragging(null)}
            >
              ⠿
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
              {item.name}
              {item.kind === "script" && <span style={{ ...muted, marginLeft: 6 }}>script</span>}
            </span>
            <ui.Button size="sm" variant="ghost" aria-label={`Move ${item.name} up`} disabled={i === 0} onClick={() => move(item.id, i - 1)}>
              ↑
            </ui.Button>
            <ui.Button size="sm" variant="ghost" aria-label={`Move ${item.name} down`} disabled={i === props.items.length - 1} onClick={() => move(item.id, i + 1)}>
              ↓
            </ui.Button>
            <ui.Button size="sm" variant="ghost" aria-label={`Remove ${item.name}`} onClick={() => saveInstalled(uninstall(props.items, item.id))}>
              Remove
            </ui.Button>
          </div>
        ))}
      </div>
    </ui.Stack>
  );
}

function FilterList(props: { deps: CommandDeps }) {
  const ui = api.ui;
  const catalogue = useShared((s) => s.catalogue);
  const problem = useShared((s) => s.problem);
  const loading = useShared((s) => s.loading);
  React.useEffect(ensureCatalogue, []);
  if (loading) return <ui.ProgressBar indeterminate label="Reading G'MIC's filters…" />;
  if (problem || !catalogue) {
    return (
      <ui.Stack gap={6}>
        <p style={muted}>{problem?.needsUpdate ? "G'MIC's filter list comes with its update, which hasn't been downloaded yet." : (problem?.text ?? "")}</p>
        <ui.Row gap={6}>
          <ui.Button size="sm" variant={problem?.needsUpdate ? "primary" : undefined} onClick={() => void loadCatalogue(props.deps, problem?.needsUpdate === true)}>
            {problem?.needsUpdate ? "Download filters" : "Try again"}
          </ui.Button>
        </ui.Row>
      </ui.Stack>
    );
  }
  return null;
}

const railStyle = { width: 190, flex: "none", display: "grid", alignContent: "start", gap: 2, paddingRight: 12, overflowY: "auto" } as const;
const indent = { paddingLeft: 18 } as const;

/** The store's left rail: its three parts, and Filters' categories. */
function Rail(props: { tab: StoreTab; category: string; installed: number; onCategory(c: string): void }) {
  const ui = api.ui;
  const catalogue = useShared((s) => s.catalogue);
  const go = (tab: StoreTab) => shared().setState({ storeTab: tab, storeScript: null });
  const tabButton = (tab: StoreTab, label: string) => (
    <ui.Button size="sm" variant="ghost" full role="tab" aria-selected={props.tab === tab} active={props.tab === tab && (tab !== "filters" || props.category === ALL)} onClick={() => {
      go(tab);
      if (tab === "filters") props.onCategory(ALL);
    }}>
      {label}
    </ui.Button>
  );
  return (
    <div role="tablist" aria-orientation="vertical" style={railStyle}>
      {tabButton("filters", "Filters")}
      {props.tab === "filters" &&
        catalogue &&
        topCategories(catalogue).map((c) => (
          <ui.Button key={c} size="sm" variant="ghost" full active={props.category === c} style={indent} onClick={() => props.onCategory(c)}>
            {c}
          </ui.Button>
        ))}
      {tabButton("scripts", "Scripts")}
      {tabButton("installed", `Installed (${props.installed})`)}
    </div>
  );
}

export function GmicStore(props: { deps: CommandDeps }) {
  const ui = api.ui;
  const items = useInstalled();
  const tab = useShared((s) => s.storeTab);
  const [category, setCategory] = React.useState(ALL);
  const { program, version, refresh } = useProgram(props.deps);
  if (program === undefined) return null;
  if (!program) {
    return (
      <div style={{ maxWidth: 560, padding: 16 }}>
        <ProgramSection
          deps={props.deps}
          program={null}
          version={version}
          onChange={() => {
            void refresh();
            void loadCatalogue(props.deps);
          }}
        />
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, padding: 16 }}>
      <Rail tab={tab} category={category} installed={items.length} onCategory={setCategory} />
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingRight: 4 }}>
        {tab === "filters" && (
          <ui.Stack gap={6}>
            <FilterList deps={props.deps} />
            <FiltersTab items={items} category={category} />
          </ui.Stack>
        )}
        {tab === "scripts" && <ScriptsTab items={items} />}
        {tab === "installed" && <InstalledTab items={items} />}
      </div>
    </div>
  );
}
