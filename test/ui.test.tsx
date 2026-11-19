import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activate } from "../src/index";
import { STORE_ID } from "../src/state";
import { INSTALLED, type Item } from "../src/stack";
import { stackArgs } from "../src/gmic/script";
import { encodeCimg } from "../src/gmic/cimg";
import { fakeApi, type ProgramCall, type Rig } from "./support/fake-api";
import type { ComponentType } from "react";
import type { ProgramRunResult } from "../src/safelight";

const fixture = readFileSync(join(__dirname, "fixtures", "filters.gmic"), "utf8");
const enc = (s: string) => new TextEncoder().encode(s);
const KEPT = { token: "t1", path: "C:\\gmic\\gmic.exe", name: "gmic.exe" };
const UNSHARP: Item = { id: "u1", kind: "filter", name: "Sharpen [Unsharp Mask]", command: "fx_unsharp" };

let rig: Rig;

function onPlatform(platform: string) {
  window.safelightNative = { platform } as Window["safelightNative"];
}

function start(installed: Item[] = []) {
  if (installed.length) rig.settings.set(INSTALLED, installed);
  activate(rig.api);
}

const lastPanel = (id: string) => [...rig.panels].reverse().find((p) => p.id === id)!;
const mountComponent = (c: ComponentType) => render(React.createElement(c));
const mountPanel = (id: string) => mountComponent(lastPanel(id).component);
const mountStore = () => mountComponent(rig.windows.find((w) => w.id === STORE_ID)!.component);

beforeEach(() => {
  rig = fakeApi();
  onPlatform("win32");
  rig.answer = (call: ProgramCall): Partial<ProgramRunResult> => {
    if (call.args.includes("_safelight_catalogue")) return { files: { "filters.gmic": enc(fixture) } };
    if (call.args[0] === "version") return { stdout: "G'MIC 4.0.7" };
    if (call.args.includes("_safelight_stack")) return { files: { "out.cimg": encodeCimg({ width: 2, height: 1, channels: 3, data: new Float32Array(6).fill(255) }) } };
    return {};
  };
});
afterEach(cleanup);

describe("activate", () => {
  it("registers the preview stage, the export step, Preferences, the store, its top-bar button, the canvas layer and the command", () => {
    start();
    expect(rig.stages.map((s) => [s.id, s.viewOnly, s.phase])).toEqual([["gmic", true, "output-encode"]]);
    expect(rig.processors.map((p) => p.id)).toEqual(["gmic.export"]);
    expect(rig.settingsSections.map((s) => s.title)).toEqual(["G'MIC"]);
    expect(rig.panels).toEqual([]);
    expect(rig.windows.map((w) => [w.id, w.title, w.maximizable])).toEqual([[STORE_ID, "G'MIC store", true]]);
    expect(rig.buttons.map((b) => b.label)).toEqual(["G'MIC store"]);
    expect(rig.buttons[0].svg).toMatch(/^<svg /);
    expect(rig.slots.map((s) => s.slot)).toEqual(["develop-canvas-overlay"]);
    expect(rig.commands.map((c) => c.name)).toEqual(["gmic"]);
  });

  it("the top-bar button opens the store's window, and closes it again", () => {
    start();
    rig.buttons[0].onClick();
    expect(rig.openWindow).toBe(STORE_ID);
    rig.buttons[0].onClick();
    expect(rig.openWindow).toBeNull();
  });

  it("registers a Develop panel for each installed item, whose eye holds off its own key only", () => {
    start([UNSHARP, { id: "s1", kind: "script", name: "Glow", source: "blur 1" }]);
    expect(rig.panels.map((p) => p.id)).toEqual(["gmic.f.u1", "gmic.f.s1"]);
    expect(lastPanel("gmic.f.u1")).toMatchObject({ title: "Sharpen [Unsharp Mask]", ownsBag: ["gmic.f.u1"], defaultDock: { module: "develop", direction: "right" } });
    expect(rig.toggled).toEqual([]);
  });

  it("brings G'MIC 1.0's saved scripts in as installed scripts", () => {
    rig.settings.set("scripts", [{ id: "x", name: "Old", source: "blur 2" }]);
    start();
    expect((rig.settings.get(INSTALLED) as Item[]).map((i) => [i.kind, i.name])).toEqual([["script", "Old"]]);
    expect(rig.settings.get("scripts")).toBeNull();
  });
});

describe("the store", () => {
  it("walks through setting G'MIC up when there is no program", async () => {
    start();
    mountStore();
    fireEvent.click(await screen.findByRole("button", { name: "Find G'MIC" }));
    expect(rig.located).toEqual(["gmic"]);
    expect(await screen.findByRole("tab", { name: "Filters" })).toBeTruthy();
  });

  it("installs a filter as a Develop panel and opens it; Remove takes it away", async () => {
    rig.kept.push(KEPT);
    start();
    mountStore();
    expect(await screen.findByText("5 filters")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search filters"), { target: { value: "unsharp" } });
    expect(screen.getByText("1 filter")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Install Sharpen [Unsharp Mask]" }));
    const [item] = rig.settings.get(INSTALLED) as Item[];
    expect(item).toMatchObject({ kind: "filter", command: "fx_unsharp" });
    expect(lastPanel(`gmic.f.${item.id}`).title).toBe("Sharpen [Unsharp Mask]");
    expect(rig.toggled).toEqual([`gmic.f.${item.id}`]);
    fireEvent.click(await screen.findByRole("button", { name: "Remove Sharpen [Unsharp Mask]" }));
    expect(rig.settings.get(INSTALLED)).toEqual([]);
    expect(rig.unregistered).toEqual([`gmic.f.${item.id}`]);
    expect(rig.toggled).toEqual([`gmic.f.${item.id}`, `gmic.f.${item.id}`]);
  });

  it("offers to download G'MIC's filters when it has none yet", async () => {
    rig.kept.push(KEPT);
    let updated = false;
    rig.answer = (call) => {
      if (call.args.includes("update")) {
        updated = true;
        return {};
      }
      if (call.args.includes("_safelight_catalogue")) return updated ? { files: { "filters.gmic": enc(fixture) } } : {};
      return {};
    };
    start();
    mountStore();
    fireEvent.click(await screen.findByRole("button", { name: "Download filters" }));
    expect(await screen.findByText("5 filters")).toBeTruthy();
  });

  it("orders the installed items, which is the order they apply in", async () => {
    rig.kept.push(KEPT);
    start([UNSHARP, { id: "s1", kind: "script", name: "Glow", source: "blur 1" }]);
    mountStore();
    fireEvent.click(await screen.findByRole("tab", { name: "Installed (2)" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Sharpen [Unsharp Mask] down" }));
    expect((rig.settings.get(INSTALLED) as Item[]).map((i) => i.id)).toEqual(["s1", "u1"]);
  });

  it("drags an item down to just above the row it's dropped on", async () => {
    rig.kept.push(KEPT);
    const items: Item[] = ["A", "B", "C"].map((n) => ({ id: n, kind: "script", name: n, source: "blur 1" }));
    start(items);
    mountStore();
    fireEvent.click(await screen.findByRole("tab", { name: "Installed (3)" }));
    const rows = screen.getAllByRole("listitem");
    rows.forEach((row, i) => {
      row.getBoundingClientRect = () => ({ top: i * 20, height: 20, bottom: i * 20 + 20, left: 0, right: 100, width: 100, x: 0, y: i * 20, toJSON: () => ({}) }) as DOMRect;
    });
    const grip = rows[0].querySelector("span")!;
    grip.setPointerCapture = () => {};
    fireEvent.pointerDown(grip, { pointerId: 1 });
    fireEvent.pointerMove(grip, { pointerId: 1, clientY: 45 });
    fireEvent.pointerUp(grip, { pointerId: 1, clientY: 45 });
    expect((rig.settings.get(INSTALLED) as Item[]).map((i) => i.id)).toEqual(["B", "A", "C"]);
  });

  it("writes a new script, installed as a panel, and edits its source", async () => {
    rig.kept.push(KEPT);
    start();
    mountStore();
    fireEvent.click(await screen.findByRole("tab", { name: "Scripts" }));
    fireEvent.click(screen.getByRole("button", { name: "New script" }));
    const [script] = rig.settings.get(INSTALLED) as Item[];
    expect(script).toMatchObject({ kind: "script", name: "New script" });
    expect(lastPanel(`gmic.f.${script.id}`).title).toBe("New script");
    fireEvent.change(screen.getByLabelText("Script source"), { target: { value: "#@gui : Amount = int(4,1,9)\nblur $1" } });
    await waitFor(() => expect(screen.getByText(/Settings: Amount\./)).toBeTruthy());
    expect((rig.settings.get(INSTALLED) as { source: string }[])[0].source).toContain("blur $1");
  });
});

describe("setting up G'MIC in Preferences", () => {
  const ZIP = "https://gmic.eu/get_file.php?file=windows/gmic_4.0.9_cli_win64.zip";
  const mountPrefs = () => {
    start();
    return mountComponent(rig.settingsSections[0].component!);
  };

  it("on Windows, downloads the newest command-line zip in the browser and says what to do with it", async () => {
    rig.downloadPage = '<a href="get_file.php?file=windows/gmic_4.0.9_cli_win64.zip">CLI</a>';
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mountPrefs();
    fireEvent.click(await screen.findByRole("button", { name: "Download G'MIC" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith(ZIP, "_blank", "noopener,noreferrer"));
    expect(screen.getByText(/Unzip it into a folder you keep/)).toBeTruthy();
    open.mockRestore();
  });

  it("on Windows, opens the download page when gmic.eu can't be read", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mountPrefs();
    fireEvent.click(await screen.findByRole("button", { name: "Download G'MIC" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://gmic.eu/download.html", "_blank", "noopener,noreferrer"));
    open.mockRestore();
  });

  it("on macOS, gives the Homebrew command to copy", async () => {
    onPlatform("darwin");
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    mountPrefs();
    expect(await screen.findByText("brew install gmic")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("brew install gmic");
  });

  it("on Linux, names the package to install", async () => {
    onPlatform("linux");
    mountPrefs();
    expect(await screen.findByText(/sudo apt install gmic/)).toBeTruthy();
  });

  it("shows the program and the filter count, and keeps the preview size", async () => {
    rig.kept.push(KEPT);
    mountPrefs();
    expect(await screen.findByText(/G'MIC 4\.0\.7 · C:\\gmic\\gmic\.exe/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Download filters" }));
    expect(await screen.findByText(/5 filters/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Preview size"), { target: { value: "1024" } });
    expect(rig.settings.get("previewSize")).toBe("1024");
  });
});

describe("a filter's panel", () => {
  beforeEach(() => rig.kept.push(KEPT));

  it("a script's Edit script… opens the store's window on that script", async () => {
    start([{ id: "s1", kind: "script", name: "Glow", source: "blur 1" }]);
    mountPanel("gmic.f.s1");
    fireEvent.click(await screen.findByRole("button", { name: "Edit script…" }));
    expect(rig.openWindow).toBe(STORE_ID);
    cleanup();
    mountStore();
    expect(((await screen.findByLabelText("Script name")) as HTMLInputElement).value).toBe("Glow");
  });

  it("narrows the store's filters to a category picked in its sidebar", async () => {
    start();
    mountStore();
    expect(await screen.findByText("5 filters")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Artistic" }));
    expect(screen.getByText("2 filters")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Filters" }));
    expect(screen.getByText("5 filters")).toBeTruthy();
  });

  it("shows the filter's settings at their defaults, off, with its preview note", async () => {
    start([UNSHARP]);
    mountPanel("gmic.f.u1");
    expect(((await screen.findByLabelText("Spatial Radius")) as HTMLInputElement).value).toBe("1.25");
    expect((screen.getByLabelText("On") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(/judge it at 100 %/)).toBeTruthy();
  });

  it("a setting moved switches it on in the photo's bag, one undo step on release", async () => {
    start([UNSHARP]);
    mountPanel("gmic.f.u1");
    const slider = await screen.findByLabelText("Spatial Radius");
    fireEvent.change(slider, { target: { value: "3" } });
    expect(rig.develop.getState().paramBag["gmic.f.u1"]).toEqual({ on: true, values: { "Spatial Radius": 3 } });
    expect(rig.commits).toEqual([]);
    fireEvent.pointerUp(slider);
    expect(rig.commits).toEqual(["G'MIC: Sharpen [Unsharp Mask]: spatial radius"]);
  });

  it("switches off keeping its values; Reset turns it off at its defaults", async () => {
    start([UNSHARP]);
    rig.develop.setState({ paramBag: { "gmic.f.u1": { on: true, values: { "Spatial Radius": 5 } } } });
    mountPanel("gmic.f.u1");
    fireEvent.click(await screen.findByLabelText("On"));
    expect(rig.develop.getState().paramBag["gmic.f.u1"]).toEqual({ on: false, values: { "Spatial Radius": 5 } });
    expect(rig.commits.at(-1)).toBe("G'MIC: Sharpen [Unsharp Mask] off");
    act(() => lastPanel("gmic.f.u1").onReset!());
    expect(rig.develop.getState().paramBag["gmic.f.u1"]).toEqual({ on: false, values: {} });
    expect(rig.commits.at(-1)).toBe("G'MIC: Sharpen [Unsharp Mask] reset");
  });
});

describe("Develop's canvas", () => {
  beforeEach(() => rig.kept.push(KEPT));

  it("previews the switched-on items through the stage once the edit settles", async () => {
    start([UNSHARP]);
    rig.develop.setState({ paramBag: { "gmic.f.u1": { on: true, values: { "Spatial Radius": 2 } } } });
    mountComponent(rig.slots[0].component);
    await waitFor(() => expect(rig.viewValues.at(-1)).toEqual({ "gmic.mode": 1, "gmic.area": [0, 0, 1, 1], "gmic.place": [0, 0, 1, 1], "gmic.gmicOut": "r1", "gmic.gmicIn": "r1" }), { timeout: 3000 });
    const run = rig.calls.find((c) => c.args.includes("_safelight_stack"))!;
    expect(run.args).toEqual(stackArgs());
    expect(new TextDecoder().decode(run.options.files!["job.gmic"])).toContain("fx_unsharp 1,2,1,0");
    expect(rig.textures.map((t) => t.key)).toEqual(["gmicOut", "gmicIn"]);
    expect(rig.textures.map((t) => t.variant)).toEqual(["r1", "r1"]);
  });

  it("shows a loading bar along the photo's top while G'MIC works on the preview, gone with the result", async () => {
    let release!: () => void;
    const working = new Promise<void>((r) => (release = r));
    const answer = rig.answer;
    rig.answer = async (call) => {
      if (call.args.includes("_safelight_stack")) await working;
      return answer(call);
    };
    start([UNSHARP]);
    rig.develop.setState({ paramBag: { "gmic.f.u1": { on: true, values: {} } } });
    mountComponent(rig.slots[0].component);
    const bar = await screen.findByRole("progressbar", { name: "G'MIC is working on the preview" }, { timeout: 3000 });
    expect(bar.style.left).toBe("0px");
    expect(bar.style.width).toBe("200px");
    expect(rig.viewValues.some((v) => v !== null)).toBe(false);
    release();
    await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull(), { timeout: 3000 });
    expect(rig.viewValues.at(-1)).toMatchObject({ "gmic.mode": 1, "gmic.gmicOut": "r1" });
  });

  it("leaves a panel held off out of the preview", async () => {
    start([UNSHARP]);
    rig.develop.setState({ paramBag: { "gmic.f.u1": { on: true, values: {} } }, bypassedPanels: { "gmic.f.u1": true } });
    mountComponent(rig.slots[0].component);
    await new Promise((r) => setTimeout(r, 400));
    expect(rig.calls.some((c) => c.args.includes("_safelight_stack"))).toBe(false);
  });

  it("draws the touched panel's points as handles, and a drag sets the point", async () => {
    const caption: Item = { id: "c1", kind: "filter", name: "Caption & Frame", command: "fx_caption" };
    start([caption]);
    rig.develop.setState({ paramBag: { "gmic.f.c1": { on: true, values: {} } } });
    mountPanel("gmic.f.c1");
    fireEvent.pointerDown(await screen.findByLabelText("On"));
    cleanup();
    mountComponent(rig.slots[0].component);
    const handle = await screen.findByRole("slider", { name: "Caption & Frame: Position" });
    expect(handle.style.left).toBe("100px");
    expect(handle.style.top).toBe("90px");
    const root = handle.parentElement!;
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    Object.defineProperty(root, "offsetWidth", { value: 200 });
    Object.defineProperty(root, "offsetHeight", { value: 100 });
    handle.setPointerCapture = () => {};
    fireEvent.pointerDown(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 50, clientY: 25 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 50, clientY: 25 });
    expect((rig.develop.getState().paramBag["gmic.f.c1"] as { values: Record<string, unknown> }).values.Position).toEqual([25, 25]);
    expect(rig.commits.at(-1)).toBe("G'MIC: Caption & Frame: position");
  });
});

describe("panel layout", () => {
  it("pads a filter panel's content as the other panels do", async () => {
    rig.kept.push(KEPT);
    start([UNSHARP]);
    const { container } = mountPanel("gmic.f.u1");
    await screen.findByLabelText("Spatial Radius");
    expect((container.firstElementChild as HTMLElement).style.padding).toBe("8px");
  });
});
