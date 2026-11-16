// The G'MIC panel: the program it runs, G'MIC's filters with their settings,
// and saved scripts. Preview runs on a small render of the open photo; Apply
// runs at the chosen size and saves the result beside the photo.

import { React, api } from "./rt";
import { applyToPhotos, type CommandDeps } from "./command";
import { DOWNLOAD_PAGE, HOMEBREW_COMMAND, currentPlatform, windowsDownload } from "./download";
import { NeedsUpdateError } from "./gmic/engine";
import { searchFilters, type Catalogue, type Filter } from "./gmic/catalogue";
import { defaultsOf, type ParamValue, type ParamValues } from "./gmic/params";
import { scriptParams, type Job } from "./gmic/script";
import { filterJob, scriptJob } from "./jobs";
import { ParamControls } from "./ParamControls";
import { PREVIEW_SIZE, SIZES, renderPng, renderSize, setRenderSize } from "./render";
import { NEW_SCRIPT, freeName, readScripts, writeScripts, type Script } from "./scripts";
import type { CatalogPhoto, KeptProgram } from "./safelight";

const MAX_LISTED = 150;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";
const muted = { margin: 0, fontSize: 11, opacity: 0.7 } as const;

function useOpenPhoto(): CatalogPhoto | null {
  const photoId = api.stores.useDevelopStore((s) => s.photoId);
  const photos = api.stores.useCatalogStore((s) => s.photos);
  return React.useMemo(() => photos.find((p) => p.id === photoId) ?? null, [photos, photoId]);
}

interface RunState {
  busy: "preview" | "apply" | null;
  status: string;
  error: string | null;
  preview: string | null;
}

function useRunner(deps: CommandDeps, photo: CatalogPhoto | null) {
  const [state, setState] = React.useState<RunState>({ busy: null, status: "", error: null, preview: null });
  const controller = React.useRef<AbortController | null>(null);
  const previewUrl = React.useRef<string | null>(null);

  const showPreview = React.useCallback((url: string | null) => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = url;
    setState((s) => ({ ...s, preview: url }));
  }, []);

  React.useEffect(() => () => {
    controller.current?.abort();
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);
  React.useEffect(() => showPreview(null), [photo?.id, showPreview]);

  async function go(kind: "preview" | "apply", work: (signal: AbortSignal) => Promise<string>) {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setState((s) => ({ ...s, busy: kind, status: kind === "preview" ? "Previewing…" : "Applying…", error: null }));
    try {
      const status = await work(c.signal);
      if (controller.current === c) setState((s) => ({ ...s, busy: null, status }));
    } catch (e) {
      if (controller.current === c) setState((s) => ({ ...s, busy: null, status: "", error: isAbort(e) ? null : message(e) }));
    }
  }

  return {
    state,
    cancel: () => controller.current?.abort(),
    preview: (job: Job) =>
      go("preview", async (signal) => {
        if (!photo) throw new Error("Open a photo in Develop.");
        const input = await renderPng(api, photo, { longEdge: PREVIEW_SIZE, bits: 8, signal });
        const [out] = await deps.engine.run(input, job, { signal });
        showPreview(URL.createObjectURL(new Blob([new Uint8Array(out)], { type: "image/png" })));
        return `Preview at ${PREVIEW_SIZE} px.`;
      }),
    apply: (job: Job) =>
      go("apply", async (signal) => {
        if (!photo) throw new Error("Open a photo in Develop.");
        let saved: string[] = [];
        await applyToPhotos(deps, {
          words: [],
          photos: [photo],
          caller: "app",
          from: api.extensionId,
          signal,
          print: () => {},
          info: () => {},
          warn: (text) => setState((s) => ({ ...s, error: text })),
          progress: (text) => {
            setState((s) => ({ ...s, status: text }));
            return { update: (t) => setState((s) => ({ ...s, status: t })), done: () => {} };
          },
          canSaveBeside: (p) => api.commands.canSaveBeside(p),
          saveBeside: (p, data, suffix, ext) => api.commands.saveBeside(p, data, suffix, ext),
          result: (value) => {
            const r = value as { saved?: string[] } | null;
            saved = r?.saved ?? [];
          },
        }, job);
        return saved.length > 0 ? `Saved ${saved.join(", ")}.` : "Done.";
      }),
  };
}

function RunBar(props: { runner: ReturnType<typeof useRunner>; job: () => Job | null; photo: CatalogPhoto | null; disabled?: boolean }) {
  const ui = api.ui;
  const { state } = props.runner;
  const [size, setSize] = React.useState(() => String(renderSize(api.settings) ?? "full"));
  const run = (kind: "preview" | "apply") => {
    const job = props.job();
    if (job) void props.runner[kind](job);
  };
  const off = !props.photo || props.disabled;
  return (
    <ui.Stack gap={6}>
      <ui.Row gap={6}>
        <ui.Button size="sm" disabled={off || state.busy !== null} onClick={() => run("preview")}>
          Preview
        </ui.Button>
        <ui.Button size="sm" variant="primary" disabled={off || state.busy !== null} onClick={() => run("apply")}>
          Apply
        </ui.Button>
        {state.busy && (
          <ui.Button size="sm" variant="ghost" onClick={props.runner.cancel}>
            Cancel
          </ui.Button>
        )}
      </ui.Row>
      <ui.Field label="Apply at" hint="Apply saves the result as a new photo beside this one.">
        <ui.Select
          ariaLabel="Apply at"
          value={size}
          options={SIZES.map((s) => ({ ...s }))}
          onChange={(v) => {
            setSize(v);
            setRenderSize(api.settings, v);
          }}
        />
      </ui.Field>
      {state.busy && <ui.ProgressBar indeterminate label={state.status} />}
      {!state.busy && state.status && <p style={muted}>{state.status}</p>}
      {state.error && (
        <p role="alert" style={{ ...muted, opacity: 1, whiteSpace: "pre-wrap" }}>
          {state.error}
        </p>
      )}
      {state.preview && <img src={state.preview} alt="G'MIC preview" style={{ width: "100%", display: "block" }} />}
      {!props.photo && <p style={muted}>Open a photo in Develop to preview or apply.</p>}
    </ui.Stack>
  );
}

function ProgramSection(props: { deps: CommandDeps; program: KeptProgram | null; version: string; onChange(): void }) {
  const ui = api.ui;
  const [error, setError] = React.useState<string | null>(null);
  const act = (work: () => Promise<unknown>) => async () => {
    setError(null);
    try {
      await work();
      props.deps.engine.reset();
      props.onChange();
    } catch (e) {
      setError(message(e));
    }
  };
  const find = act(async () => {
    const found = await api.programs.locate("gmic");
    if (!found) setError("No gmic program was found where programs usually are, or it wasn't allowed. Choose it yourself.");
  });
  const choose = act(() => api.programs.pick({ title: "Choose the gmic program", replacing: props.program?.token ?? null }));
  const forget = act(async () => {
    if (props.program) await api.programs.forget(props.program.token);
  });
  return (
    <ui.Section title="G'MIC program">
      <ui.Stack gap={6}>
        {props.program ? (
          <>
            <p style={{ ...muted, wordBreak: "break-all" }}>
              {props.version ? `G'MIC ${props.version}` : "G'MIC"} · {props.program.path}
            </p>
            <ui.Row gap={6} wrap>
              <ui.Button size="sm" onClick={choose}>
                Change…
              </ui.Button>
              <ui.Button size="sm" variant="ghost" onClick={forget}>
                Forget
              </ui.Button>
            </ui.Row>
          </>
        ) : (
          <SetUpSteps find={find} choose={choose} />
        )}
        {error && <p role="alert" style={{ ...muted, opacity: 1 }}>{error}</p>}
      </ui.Stack>
    </ui.Section>
  );
}

const stepsStyle = { margin: 0, paddingLeft: 18, fontSize: 11, display: "grid", gap: 6 } as const;
const codeStyle = { fontSize: 11, userSelect: "all" } as const;
const openInBrowser = (url: string) => void window.open(url, "_blank", "noopener,noreferrer");

/** How to get the gmic program on this platform, then find or choose it. */
function SetUpSteps(props: { find(): void; choose(): void }) {
  const ui = api.ui;
  const platform = React.useMemo(currentPlatform, []);
  const [note, setNote] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const download = async () => {
    setNote("Looking up the newest G'MIC…");
    const url = await windowsDownload((u) => api.network.fetch(u));
    openInBrowser(url);
    setNote(
      url === DOWNLOAD_PAGE
        ? "gmic.eu's download page is open in your browser: get the command-line (CLI) zip for Windows."
        : "Your browser is downloading the zip.",
    );
  };
  const copy = async () => {
    await navigator.clipboard.writeText(HOMEBREW_COMMAND);
    setCopied(true);
  };
  const intro = <p style={muted}>G'MIC is a free program, from gmic.eu, that this panel runs. Set it up once:</p>;

  if (platform === "windows") {
    return (
      <ui.Stack gap={6}>
        {intro}
        <ol style={stepsStyle}>
          <li>
            <ui.Button size="sm" variant="primary" onClick={() => void download()}>
              Download G'MIC
            </ui.Button>
          </li>
          <li>Unzip it into a folder you keep, such as Documents\G'MIC.</li>
          <li>
            Choose gmic.exe in that folder.
            <ui.Row gap={6} wrap>
              <ui.Button size="sm" onClick={props.choose}>
                Choose…
              </ui.Button>
              <ui.Button size="sm" variant="ghost" onClick={props.find}>
                Find G'MIC
              </ui.Button>
            </ui.Row>
          </li>
        </ol>
        {note && <p style={muted}>{note}</p>}
      </ui.Stack>
    );
  }

  if (platform === "mac") {
    return (
      <ui.Stack gap={6}>
        {intro}
        <ol style={stepsStyle}>
          <li>
            Install it with Homebrew: in the Terminal app, run
            <ui.Row gap={6}>
              <code style={codeStyle}>{HOMEBREW_COMMAND}</code>
              <ui.Button size="sm" variant="ghost" onClick={() => void copy()}>
                {copied ? "Copied" : "Copy"}
              </ui.Button>
            </ui.Row>
          </li>
          <li>
            Then find it here.
            <ui.Row gap={6} wrap>
              <ui.Button size="sm" variant="primary" onClick={props.find}>
                Find G'MIC
              </ui.Button>
              <ui.Button size="sm" onClick={props.choose}>
                Choose…
              </ui.Button>
            </ui.Row>
          </li>
        </ol>
        <p style={muted}>No Homebrew yet? It installs from brew.sh.</p>
      </ui.Stack>
    );
  }

  return (
    <ui.Stack gap={6}>
      {intro}
      <ol style={stepsStyle}>
        <li>Install your distribution's gmic package, such as sudo apt install gmic or sudo dnf install gmic.</li>
        <li>
          Then find it here.
          <ui.Row gap={6} wrap>
            <ui.Button size="sm" variant="primary" onClick={props.find}>
              Find G'MIC
            </ui.Button>
            <ui.Button size="sm" onClick={props.choose}>
              Choose…
            </ui.Button>
            <ui.Button size="sm" variant="ghost" onClick={() => openInBrowser(DOWNLOAD_PAGE)}>
              Download page
            </ui.Button>
          </ui.Row>
        </li>
      </ol>
    </ui.Stack>
  );
}

function FiltersTab(props: { deps: CommandDeps; photo: CatalogPhoto | null }) {
  const ui = api.ui;
  const [catalogue, setCatalogue] = React.useState<Catalogue | null>(null);
  const [problem, setProblem] = React.useState<{ needsUpdate: boolean; text: string } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<Filter | null>(null);
  const [values, setValues] = React.useState<ParamValues>({});
  const runner = useRunner(props.deps, props.photo);

  const load = React.useCallback(async (update: boolean) => {
    setLoading(true);
    setProblem(null);
    try {
      setCatalogue(update ? await props.deps.engine.update() : await props.deps.engine.catalogue());
    } catch (e) {
      setProblem({ needsUpdate: e instanceof NeedsUpdateError, text: message(e) });
    } finally {
      setLoading(false);
    }
  }, [props.deps]);
  React.useEffect(() => void load(false), [load]);

  const found = React.useMemo(() => (catalogue ? searchFilters(catalogue, search) : []), [catalogue, search]);

  if (loading) return <ui.ProgressBar indeterminate label="Reading G'MIC's filters…" />;
  if (problem) {
    return (
      <ui.Stack gap={6}>
        <p style={muted}>{problem.needsUpdate ? "G'MIC's filter list comes with its update, which hasn't been downloaded yet." : problem.text}</p>
        <ui.Row gap={6}>
          {problem.needsUpdate ? (
            <ui.Button size="sm" variant="primary" onClick={() => void load(true)}>
              Download filters
            </ui.Button>
          ) : (
            <ui.Button size="sm" onClick={() => void load(false)}>
              Try again
            </ui.Button>
          )}
        </ui.Row>
      </ui.Stack>
    );
  }
  if (!catalogue) return null;

  if (filter) {
    return (
      <ui.Stack gap={8}>
        <ui.Row gap={6} justify="space-between">
          <ui.Button size="sm" variant="ghost" onClick={() => setFilter(null)}>
            ← Filters
          </ui.Button>
          <ui.Button size="sm" variant="ghost" onClick={() => setValues(defaultsOf(filter.params))}>
            Reset
          </ui.Button>
        </ui.Row>
        <p style={{ margin: 0, fontWeight: 600 }}>{filter.name}</p>
        <p style={muted}>
          {filter.category} · {filter.command}
        </p>
        <ParamControls params={filter.params} values={values} onChange={(name, v: ParamValue) => setValues((s) => ({ ...s, [name]: v }))} />
        <RunBar runner={runner} photo={props.photo} job={() => filterJob(filter, values)} />
      </ui.Stack>
    );
  }

  return (
    <ui.Stack gap={6}>
      <ui.Row gap={6}>
        <ui.TextInput value={search} placeholder="Search filters" aria-label="Search filters" onChange={setSearch} />
        <ui.Button size="sm" variant="ghost" title="Download G'MIC's latest filters" onClick={() => void load(true)}>
          Update
        </ui.Button>
      </ui.Row>
      <p style={muted}>{found.length === 1 ? "1 filter" : `${found.length} filters`}</p>
      <div role="list" aria-label="Filters">
        {found.slice(0, MAX_LISTED).map((f) => (
          <ui.Button
            key={`${f.category}/${f.name}`}
            role="listitem"
            size="sm"
            variant="ghost"
            full
            title={`${f.category} › ${f.name}`}
            onClick={() => {
              setFilter(f);
              setValues(defaultsOf(f.params));
            }}
          >
            <span style={{ opacity: 0.6 }}>{f.category} › </span>
            {f.name}
          </ui.Button>
        ))}
      </div>
      {found.length > MAX_LISTED && <p style={muted}>{found.length - MAX_LISTED} more: narrow the search.</p>}
    </ui.Stack>
  );
}

function ScriptsTab(props: { deps: CommandDeps; photo: CatalogPhoto | null }) {
  const ui = api.ui;
  const [scripts, setScripts] = React.useState<Script[]>(() => readScripts(api.settings));
  const [selectedId, setSelectedId] = React.useState<string | null>(() => scripts[0]?.id ?? null);
  const [values, setValues] = React.useState<ParamValues>({});
  const runner = useRunner(props.deps, props.photo);
  const selected = scripts.find((s) => s.id === selectedId) ?? null;
  const params = React.useMemo(() => (selected ? scriptParams(selected.source) : []), [selected?.source]);

  React.useEffect(() => setValues(defaultsOf(params)), [selectedId, params.length]);
  React.useEffect(() => api.settings.onChange((key) => key === "scripts" && setScripts(readScripts(api.settings))), []);

  const save = (next: Script[]) => {
    setScripts(next);
    writeScripts(api.settings, next);
  };
  const update = (patch: Partial<Script>) => selected && save(scripts.map((s) => (s.id === selected.id ? { ...s, ...patch } : s)));
  const add = () => {
    const script: Script = { id: crypto.randomUUID(), name: freeName(scripts, "New script"), source: NEW_SCRIPT };
    save([...scripts, script]);
    setSelectedId(script.id);
  };
  const remove = () => {
    if (!selected) return;
    const next = scripts.filter((s) => s.id !== selected.id);
    save(next);
    setSelectedId(next[0]?.id ?? null);
  };
  const named = selected ? freeName(scripts.filter((s) => s.id !== selected.id), selected.name.trim() || "Script") : "";

  return (
    <ui.Stack gap={8}>
      <ui.Row gap={6}>
        {scripts.length > 0 && (
          <ui.Select
            ariaLabel="Saved script"
            value={selectedId ?? ""}
            options={scripts.map((s) => ({ value: s.id, label: s.name }))}
            onChange={setSelectedId}
          />
        )}
        <ui.Button size="sm" onClick={add}>
          New
        </ui.Button>
        {selected && (
          <ui.Button size="sm" variant="ghost" onClick={remove}>
            Delete
          </ui.Button>
        )}
      </ui.Row>
      {!selected && <p style={muted}>No scripts yet. A script is G'MIC words, run on the photo; it also runs as gmic script &lt;name&gt; in the Terminal and the safelight command line.</p>}
      {selected && (
        <>
          <ui.Field label="Name" hint={named !== selected.name ? `Another script has this name; it runs as "${named}" once renamed.` : undefined}>
            <ui.TextInput aria-label="Script name" value={selected.name} onChange={(name) => update({ name })} onBlur={() => update({ name: named })} />
          </ui.Field>
          <ui.TextArea mono rows={10} aria-label="Script source" spellCheck={false} value={selected.source} onChange={(source) => update({ source })} />
          <ParamControls params={params} values={values} onChange={(name, v) => setValues((s) => ({ ...s, [name]: v }))} />
          <RunBar runner={runner} photo={props.photo} job={() => scriptJob(selected.source, values)} />
        </>
      )}
    </ui.Stack>
  );
}

export function GmicPanel(props: { deps: CommandDeps }) {
  const ui = api.ui;
  const photo = useOpenPhoto();
  const [tab, setTab] = React.useState("filters");
  const [program, setProgram] = React.useState<KeptProgram | null | undefined>(undefined);
  const [version, setVersion] = React.useState("");

  const refresh = React.useCallback(async () => {
    const p = await props.deps.engine.program();
    setProgram(p);
    setVersion("");
    if (p) props.deps.engine.version().then(setVersion, () => setVersion(""));
  }, [props.deps]);
  React.useEffect(() => void refresh(), [refresh]);

  if (program === undefined) return null;
  return (
    <ui.Stack gap={10}>
      <ProgramSection deps={props.deps} program={program} version={version} onChange={() => void refresh()} />
      {program && (
        <>
          <ui.SegmentedControl
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: "filters", label: "Filters" },
              { value: "scripts", label: "Scripts" },
            ]}
          />
          {tab === "filters" ? (
            <FiltersTab key={program.token} deps={props.deps} photo={photo} />
          ) : (
            <ScriptsTab deps={props.deps} photo={photo} />
          )}
        </>
      )}
    </ui.Stack>
  );
}
