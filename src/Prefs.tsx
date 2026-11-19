// G'MIC's section in Preferences: the program, G'MIC's filter list, the
// preview's size and the size the gmic command renders at.

import { React, api } from "./rt";
import type { CommandDeps } from "./command";
import { SIZES, renderSize, setRenderSize } from "./render";
import { ProgramSection, useProgram } from "./Setup";
import { loadCatalogue, useShared } from "./state";

const muted = { margin: 0, fontSize: 11, opacity: 0.7 } as const;

export const PREVIEW_SIZE_KEY = "previewSize";

export const PREVIEW_SIZES: readonly { value: string; label: string }[] = [
  { value: "screen", label: "As shown on screen" },
  { value: "2048", label: "2048 px at most" },
  { value: "1024", label: "1024 px at most (fastest)" },
];

/** The longest edge a preview gives G'MIC, for a view `shown` px across. */
export function previewEdge(settings: { get<T>(key: string, fallback: T): T }, shown: number): number {
  const choice = settings.get<unknown>(PREVIEW_SIZE_KEY, "screen");
  const cap = typeof choice === "string" && /^\d+$/.test(choice) ? Number(choice) : Infinity;
  return Math.max(64, Math.round(Math.min(shown, cap)));
}

function FiltersSection(props: { deps: CommandDeps }) {
  const ui = api.ui;
  const catalogue = useShared((s) => s.catalogue);
  const problem = useShared((s) => s.problem);
  const loading = useShared((s) => s.loading);
  const count = catalogue?.categories.reduce((n, c) => n + c.filters.length, 0) ?? 0;
  return (
    <ui.Section title="Filters">
      <ui.Stack gap={6}>
        {loading && <ui.ProgressBar indeterminate label="Reading G'MIC's filters…" />}
        {!loading && catalogue && <p style={muted}>{`${count} filters${catalogue.version ? `, for G'MIC ${catalogue.version}` : ""}.`}</p>}
        {!loading && problem && <p style={muted}>{problem.needsUpdate ? "G'MIC's filter list comes with its update, which hasn't been downloaded yet." : problem.text}</p>}
        <ui.Row gap={6}>
          <ui.Button size="sm" disabled={loading} onClick={() => void loadCatalogue(props.deps, true)}>
            {catalogue ? "Update filters" : "Download filters"}
          </ui.Button>
        </ui.Row>
      </ui.Stack>
    </ui.Section>
  );
}

function SizeField(props: { label: string; hint: string; value: string; options: readonly { value: string; label: string }[]; onChange(v: string): void }) {
  const ui = api.ui;
  const [value, setValue] = React.useState(props.value);
  return (
    <ui.Field label={props.label} hint={props.hint}>
      <ui.Select
        ariaLabel={props.label}
        value={value}
        options={props.options.map((o) => ({ ...o }))}
        onChange={(v) => {
          setValue(v);
          props.onChange(v);
        }}
      />
    </ui.Field>
  );
}

export function GmicPreferences(props: { deps: CommandDeps }) {
  const ui = api.ui;
  const { program, version, refresh } = useProgram(props.deps);
  if (program === undefined) return null;
  return (
    <ui.Stack gap={12}>
      <ProgramSection
        deps={props.deps}
        program={program}
        version={version}
        onChange={() => {
          void refresh();
          void loadCatalogue(props.deps);
        }}
      />
      {program && <FiltersSection deps={props.deps} />}
      <ui.Section title="Preview">
        <SizeField
          label="Preview size"
          hint="How large a picture G'MIC previews in Develop. Smaller is faster; exports always run at full size."
          value={String(api.settings.get<unknown>(PREVIEW_SIZE_KEY, "screen"))}
          options={PREVIEW_SIZES}
          onChange={(v) => api.settings.set(PREVIEW_SIZE_KEY, v)}
        />
      </ui.Section>
      <ui.Section title="gmic command">
        <SizeField
          label="Render at"
          hint="The size the gmic command in the Terminal and at the command line runs at, each result saved beside its photo."
          value={String(renderSize(api.settings) ?? "full")}
          options={SIZES}
          onChange={(v) => setRenderSize(api.settings, v)}
        />
      </ui.Section>
    </ui.Stack>
  );
}
