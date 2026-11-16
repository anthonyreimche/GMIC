import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activate } from "../src/index";
import { fakeApi, type ProgramCall, type Rig } from "./support/fake-api";
import type { ProgramRunResult } from "../src/safelight";

const fixture = readFileSync(join(__dirname, "fixtures", "filters.gmic"), "utf8");
const enc = (s: string) => new TextEncoder().encode(s);

let rig: Rig;

function mount() {
  activate(rig.api);
  const Panel = rig.panels[0].component;
  return render(React.createElement(Panel));
}

function onPlatform(platform: string) {
  window.safelightNative = { platform } as Window["safelightNative"];
}

beforeEach(() => {
  rig = fakeApi();
  onPlatform("win32");
  URL.createObjectURL = () => "blob:preview";
  URL.revokeObjectURL = () => {};
  rig.answer = (call: ProgramCall): Partial<ProgramRunResult> => {
    if (call.args.includes("_safelight_catalogue")) return { files: { "filters.gmic": enc(fixture) } };
    if (call.args[0] === "version") return { stdout: "G'MIC 4.0.7" };
    if (call.args.includes("_safelight_run")) return { files: { "out.png": new Uint8Array([9]) } };
    return {};
  };
});
afterEach(cleanup);

describe("GmicPanel", () => {
  it("offers to find G'MIC when no program is kept, then shows it", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Find G'MIC" }));
    expect(rig.located).toEqual(["gmic"]);
    expect(await screen.findByText(/G'MIC 4\.0\.7 · C:\\gmic\\gmic\.exe/)).toBeTruthy();
  });

  it("lists filters, narrows them by search, and opens one with its settings", async () => {
    rig.kept.push({ token: "t1", path: "C:\\gmic\\gmic.exe", name: "gmic.exe" });
    mount();
    expect(await screen.findByText("5 filters")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search filters"), { target: { value: "unsharp" } });
    expect(screen.getByText("1 filter")).toBeTruthy();
    fireEvent.click(screen.getByRole("listitem"));
    expect(screen.getByText("Sharpen [Unsharp Mask]")).toBeTruthy();
    expect((screen.getByLabelText("Spatial Radius") as HTMLInputElement).value).toBe("1.25");
  });

  it("applies a filter at full size in 16 bits and saves the result beside the photo", async () => {
    rig.kept.push({ token: "t1", path: "C:\\gmic\\gmic.exe", name: "gmic.exe" });
    mount();
    fireEvent.change(await screen.findByLabelText("Search filters"), { target: { value: "unsharp" } });
    fireEvent.click(screen.getByRole("listitem"));
    fireEvent.change(screen.getByLabelText("Spatial Radius"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("Saved IMG_1-gmic.png.")).toBeTruthy();
    expect(rig.renders.at(-1)?.settings).toMatchObject({ format: "image/png", pngBitDepth: 16, longEdge: null });
    const run = rig.calls.find((c) => c.args.includes("_safelight_run"))!;
    expect(new TextDecoder().decode(run.options.files!["job.gmic"])).toContain("fx_unsharp 1,3,1,0");
    expect(rig.saved).toEqual([{ photo: "p1", suffix: "gmic", ext: "png", type: "image/png" }]);
  });

  it("previews on a small 8-bit render without saving", async () => {
    rig.kept.push({ token: "t1", path: "C:\\gmic\\gmic.exe", name: "gmic.exe" });
    mount();
    fireEvent.change(await screen.findByLabelText("Search filters"), { target: { value: "unsharp" } });
    fireEvent.click(screen.getByRole("listitem"));
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    const img = (await screen.findByAltText("G'MIC preview")) as HTMLImageElement;
    expect(img.src).toBe("blob:preview");
    expect(rig.renders.at(-1)?.settings).toMatchObject({ pngBitDepth: 8, longEdge: 1024 });
    expect(rig.saved).toEqual([]);
  });

  it("offers to download G'MIC's filters when it has none yet", async () => {
    rig.kept.push({ token: "t1", path: "C:\\gmic\\gmic.exe", name: "gmic.exe" });
    let updated = false;
    rig.answer = (call: ProgramCall): Partial<ProgramRunResult> => {
      if (call.args.includes("update")) {
        updated = true;
        return {};
      }
      if (call.args.includes("_safelight_catalogue")) return updated ? { files: { "filters.gmic": enc(fixture) } } : {};
      return {};
    };
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Download filters" }));
    expect(await screen.findByText("5 filters")).toBeTruthy();
  });

  it("shows G'MIC's error in the panel", async () => {
    rig.kept.push({ token: "t1", path: "C:\\gmic\\gmic.exe", name: "gmic.exe" });
    const base = rig.answer;
    rig.answer = (call: ProgramCall): Partial<ProgramRunResult> => (call.args.includes("_safelight_run") ? { exitCode: 1, stderr: "[gmic] *** Error *** Unknown command 'fx_unsharp'." } : base(call));
    mount();
    fireEvent.change(await screen.findByLabelText("Search filters"), { target: { value: "unsharp" } });
    fireEvent.click(screen.getByRole("listitem"));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Unknown command 'fx_unsharp'/);
  });

  it("writes a new script into settings and reads its #@gui settings", async () => {
    rig.kept.push({ token: "t1", path: "C:\\gmic\\gmic.exe", name: "gmic.exe" });
    mount();
    fireEvent.click(await screen.findByRole("tab", { name: "Scripts" }));
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    const stored = rig.settings.get("scripts") as { name: string; source: string }[];
    expect(stored.map((s) => s.name)).toEqual(["New script"]);
    expect(screen.getByLabelText("Strength")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Script source"), { target: { value: "#@gui : Amount = int(4,1,9)\nblur $1" } });
    await waitFor(() => expect(screen.getByLabelText("Amount")).toBeTruthy());
    expect((rig.settings.get("scripts") as { source: string }[])[0].source).toContain("blur $1");
  });
});

describe("setting up G'MIC", () => {
  const ZIP = "https://gmic.eu/get_file.php?file=windows/gmic_4.0.9_cli_win64.zip";

  it("on Windows, downloads the newest command-line zip in the browser and says what to do with it", async () => {
    rig.downloadPage = '<a href="get_file.php?file=windows/gmic_4.0.9_cli_win64.zip">CLI</a>';
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Download G'MIC" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith(ZIP, "_blank", "noopener,noreferrer"));
    expect(rig.fetched).toEqual(["https://gmic.eu/download.html"]);
    expect(screen.getByText(/Unzip it into a folder you keep/)).toBeTruthy();
    expect(screen.getByText(/gmic\.exe/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose…" })).toBeTruthy();
    open.mockRestore();
  });

  it("on Windows, opens the download page when gmic.eu can't be read", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Download G'MIC" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://gmic.eu/download.html", "_blank", "noopener,noreferrer"));
    open.mockRestore();
  });

  it("on macOS, gives the Homebrew command to copy, then finds it", async () => {
    onPlatform("darwin");
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    mount();
    expect(await screen.findByText("brew install gmic")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Download G'MIC" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("brew install gmic");
    expect(screen.getByRole("button", { name: "Find G'MIC" })).toBeTruthy();
  });

  it("on Linux, names the package to install, then finds it", async () => {
    onPlatform("linux");
    mount();
    expect(await screen.findByText(/sudo apt install gmic/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Find G'MIC" })).toBeTruthy();
  });
});

