// Setting G'MIC up: the program it runs, found, chosen or downloaded, shown
// in Preferences and in the store until it's set up.

import { React, api } from "./rt";
import type { CommandDeps } from "./command";
import { DOWNLOAD_PAGE, HOMEBREW_COMMAND, currentPlatform, windowsDownload } from "./download";
import type { KeptProgram } from "./safelight";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const muted = { margin: 0, fontSize: 11, opacity: 0.7 } as const;

/** The kept program and its version: undefined while asking. */
export function useProgram(deps: CommandDeps) {
  const [program, setProgram] = React.useState<KeptProgram | null | undefined>(undefined);
  const [version, setVersion] = React.useState("");
  const refresh = React.useCallback(async () => {
    const p = await deps.engine.program();
    setProgram(p);
    setVersion("");
    if (p) deps.engine.version().then(setVersion, () => setVersion(""));
  }, [deps]);
  React.useEffect(() => void refresh(), [refresh]);
  return { program, version, refresh };
}

export function ProgramSection(props: { deps: CommandDeps; program: KeptProgram | null; version: string; onChange(): void }) {
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
export function SetUpSteps(props: { find(): void; choose(): void }) {
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

