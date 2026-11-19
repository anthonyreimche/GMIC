// One installed filter or script as a Develop panel: its switch, its
// settings for the open photo, and a note where its preview isn't at true
// scale. A setting moved while it's off switches it on.

import { React, api } from "./rt";
import { stepParams, stepValues } from "./jobs";
import { ParamControls } from "./ParamControls";
import { itemKey, readState, statePatch, withData, withValue, type Item, type ItemState } from "./stack";
import { editorFor } from "./interactive";
import { ensureCatalogue, openStore, shared, useInstalled, useShared } from "./state";
import type { ParamValue } from "./gmic/params";
import type { PreviewScale } from "./gmic/catalogue";

const muted = { margin: 0, fontSize: 11, opacity: 0.7 } as const;

const SCALE_NOTE: Record<Exclude<PreviewScale, "any">, string> = {
  actual: "Its settings are in pixels: judge it at 100 %.",
  whole: "Judge it with the whole photo in view: zoomed in, its preview can differ from the export.",
};

function write(id: string, state: ItemState): void {
  api.stores.useDevelopStore.getState().setDynParams(statePatch(id, state));
}

function commit(label: string): void {
  void api.stores.useDevelopStore.getState().commitEdit(`G'MIC: ${label}`);
}

/** The panel's Reset: off, at its defaults. */
export function resetItem(item: Item): void {
  write(item.id, { on: false, values: {} });
  commit(`${item.name} reset`);
}

function Body(props: { item: Item }) {
  const ui = api.ui;
  const { item } = props;
  const stored = api.stores.useDevelopStore((s) => s.paramBag[itemKey(item.id)]);
  const catalogue = useShared((s) => s.catalogue);
  const problem = useShared((s) => s.problem);
  const error = useShared((s) => s.status.error);
  const state = readState({ [itemKey(item.id)]: stored }, item.id);
  const params = React.useMemo(() => stepParams(item, catalogue), [item, catalogue]);
  const values = React.useMemo(() => stepValues(params, state?.values ?? {}), [params, state?.values]);
  React.useEffect(() => {
    if (item.kind === "filter") ensureCatalogue();
  }, [item.kind]);
  const filter = item.kind === "filter" && catalogue ? catalogue.categories.flatMap((c) => c.filters).find((f) => f.command === item.command) : undefined;

  if (item.kind === "filter" && !catalogue) {
    return (
      <ui.Stack gap={6}>
        <p style={muted}>{problem ? problem.text : "Reading G'MIC's filters…"}</p>
        {problem && (
          <ui.Button size="sm" onClick={() => openStore("filters")}>
            Open the G'MIC store
          </ui.Button>
        )}
      </ui.Stack>
    );
  }
  if (item.kind === "filter" && !filter) {
    return <p style={muted}>This G'MIC has no "{item.name}" filter. Update G'MIC's filters in Preferences, or remove it in the G'MIC store.</p>;
  }

  const editor = filter?.interactive ? editorFor(filter.command) : undefined;
  const shownParams = editor ? params.filter((p) => "name" in p && editor.settings.includes(p.name)) : params;
  const change = (name: string, value: ParamValue) => write(item.id, withValue(readCurrent(item.id), name, value));
  return (
    <ui.Stack gap={8}>
      <ui.Toggle
        label="On"
        checked={state?.on === true}
        onChange={(on) => {
          write(item.id, { on, values: readCurrent(item.id)?.values ?? values });
          commit(`${item.name} ${on ? "on" : "off"}`);
        }}
      />
      {filter && filter.previewScale !== "any" && <p style={muted}>{SCALE_NOTE[filter.previewScale]}</p>}
      <ParamControls params={shownParams} values={values} onChange={change} onCommit={(name) => commit(`${item.name}: ${name.toLowerCase()}`)} />
      {editor?.Panel && filter && (
        <editor.Panel
          id={item.id}
          name={item.name}
          filter={filter}
          values={values}
          data={state?.data}
          setData={(data) => write(item.id, withData(readCurrent(item.id), data))}
          commit={(label) => commit(label.replace(/^G'MIC: /, ""))}
        />
      )}
      {shownParams.length === 0 && !editor && <p style={muted}>No settings.</p>}
      {item.kind === "script" && (
        <ui.Button size="sm" variant="ghost" onClick={() => openStore("scripts", item.id)}>
          Edit script…
        </ui.Button>
      )}
      {state?.on && error && (
        <p role="alert" style={{ ...muted, opacity: 1, whiteSpace: "pre-wrap" }}>
          {error}
        </p>
      )}
    </ui.Stack>
  );
}

/** The bag as the store holds it now: a drag outruns renders. */
function readCurrent(id: string): ItemState | null {
  return readState(api.stores.useDevelopStore.getState().paramBag, id);
}

export function FilterPanel(props: { id: string }) {
  const item = useInstalled().find((i) => i.id === props.id);
  if (!item) return null;
  return (
    <div style={{ padding: 8 }} onPointerDownCapture={() => shared().setState({ focus: props.id })}>
      <Body item={item} />
    </div>
  );
}
