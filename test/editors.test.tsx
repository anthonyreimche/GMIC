import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activate } from "../src/index";
import { STORE_ID } from "../src/state";
import { INSTALLED, type Item } from "../src/stack";
import { fakeApi, type Rig } from "./support/fake-api";
import type { ComponentType } from "react";

const FILE = [
  "#@gui <b>Colors</b>",
  "#@gui Curves:fx_curves_interactive,fx_curves_interactive_preview",
  '#@gui :Color Space=choice("RGB","CMY","CMYK","HSI","HSL","HSV","Lab","Lch","YCbCr")',
  '#@gui :Output Preset as a HaldCLUT Layer=_choice("Disable","Lowres CLUT","Highres CLUT")',
  "#@gui :_=value(0)",
  "#@gui :_=value(0,0,100,100)",
  "#@gui Colorize [Interactive]:fx_colorize_interactive,fx_colorize_interactive_preview",
  '#@gui :Input Type=_choice("B&W Photograph","Lineart")',
  '#@gui :View Resolution=_choice{1,"Small (Faster)","Medium"}',
  "#@gui Color Mask [Interactive]:fx_mask_color,gui_no_preview",
  "#@gui _<b>Deformations</b>",
  '#@gui Warp [Interactive]:fx_warp_interactive,fx_warp_interactive_preview(1)',
  '#@gui :Preview Precision=choice{1,"Coarsest (faster)","Coarse"}',
  "fx_curves_interactive : gui_check_x11_gdi32 0",
  "fx_colorize_interactive : skip \"${4=}\" gui_check_x11_gdi32 0",
  "fx_mask_color : gui_check_x11_gdi32 0",
  "fx_warp_interactive : gui_check_x11_gdi32 0",
].join("\n");

const CURVES: Item = { id: "c", kind: "filter", name: "Curves", command: "fx_curves_interactive" };
const COLORIZE: Item = { id: "z", kind: "filter", name: "Colorize [Interactive]", command: "fx_colorize_interactive" };
const WARP: Item = { id: "w", kind: "filter", name: "Warp [Interactive]", command: "fx_warp_interactive" };

let rig: Rig;
const enc = (s: string) => new TextEncoder().encode(s);
const lastPanel = (id: string) => [...rig.panels].reverse().find((p) => p.id === id)!;
const mount = (c: ComponentType) => render(React.createElement(c));
const RECT = { x: 0, y: 0, w: 200, h: 100 };
/** Over the photo while placing: the slot arms the canvas tool, whose overlay takes the presses. */
function mountPlacing() {
  mount(rig.slots[0].component);
  const tool = rig.canvasTool()!;
  render(React.createElement(tool.overlay, { rect: RECT }));
  return tool;
}
const bag = (id: string) => rig.develop.getState().paramBag[`gmic.f.${id}`] as { on: boolean; data?: { curves?: number[][]; points?: number[][] } };

function box(el: Element, width: number, height: number) {
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  Object.defineProperty(el, "offsetWidth", { value: width, configurable: true });
  Object.defineProperty(el, "offsetHeight", { value: height, configurable: true });
  (el as HTMLElement).setPointerCapture = () => {};
}

beforeEach(() => {
  rig = fakeApi();
  rig.kept.push({ token: "t1", path: "C:\\gmic\\gmic.exe", name: "gmic.exe" });
  rig.answer = (call) => (call.args.includes("_safelight_catalogue") ? { files: { "filters.gmic": enc(FILE) } } : {});
});
afterEach(cleanup);

function start(items: Item[]) {
  rig.settings.set(INSTALLED, items);
  activate(rig.api);
}

describe("the store and interactive filters", () => {
  it("offers Curves, Colorize and Warp, but not Color Mask", async () => {
    start([]);
    mount(rig.windows.find((w) => w.id === STORE_ID)!.component);
    expect(await screen.findByRole("button", { name: "Install Curves" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Install Colorize [Interactive]" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Install Warp [Interactive]" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Install Color Mask [Interactive]" })).toBeNull();
    expect(screen.getByText("Not available")).toBeTruthy();
  });
});

describe("Curves", () => {
  it("shows its colour space only, and a curve per channel", async () => {
    start([CURVES]);
    mount(lastPanel("gmic.f.c").component);
    expect(await screen.findByLabelText("Color Space")).toBeTruthy();
    expect(screen.queryByLabelText("Output Preset as a HaldCLUT Layer")).toBeNull();
    expect(screen.getByRole("img", { name: "Red curve" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Blue" }));
    expect(screen.getByRole("img", { name: "Blue curve" })).toBeTruthy();
  });

  it("a press adds a point, a drag moves it, and letting go is one undo step", async () => {
    start([CURVES]);
    mount(lastPanel("gmic.f.c").component);
    const svg = await screen.findByRole("img", { name: "Red curve" });
    box(svg, 100, 100);
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 30, clientY: 50 });
    expect(bag("c").on).toBe(true);
    expect(bag("c").data!.curves![0]).toEqual([0, 0, 30, 50, 100, 100]);
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 30, clientY: 20 });
    expect(bag("c").data!.curves![0]).toEqual([0, 0, 30, 80, 100, 100]);
    expect(rig.commits).toEqual([]);
    fireEvent.pointerUp(svg, { pointerId: 1 });
    expect(rig.commits).toEqual(["G'MIC: Curves: red curve"]);
  });
});

describe("Colorize", () => {
  it("places the chosen colour where the photo is pressed, listed in its panel", async () => {
    start([COLORIZE]);
    mount(lastPanel("gmic.f.z").component);
    fireEvent.change(await screen.findByLabelText("Colour to place"), { target: { value: "#ff0000" } });
    fireEvent.click(screen.getByRole("button", { name: "Place colours on the photo" }));
    expect(screen.queryByLabelText("View Resolution")).toBeNull();
    cleanup();
    mountPlacing();
    const layer = await screen.findByTestId("gmic-place-layer");
    box(layer.parentElement!, 200, 100);
    fireEvent.pointerDown(layer, { pointerId: 1, clientX: 50, clientY: 25 });
    fireEvent.pointerUp(layer, { pointerId: 1 });
    expect(bag("z").data!.points).toEqual([[25, 25, 255, 0, 0]]);
    expect(rig.commits.at(-1)).toBe("G'MIC: Colorize [Interactive]: colour");
    expect(screen.getByRole("slider", { name: "Colorize [Interactive]: colour 1" })).toBeTruthy();
  });
});

describe("Warp", () => {
  it("a drag on the photo makes a keypoint from where it started to where it ends; double-click removes it", async () => {
    start([WARP]);
    mount(lastPanel("gmic.f.w").component);
    fireEvent.click(await screen.findByRole("button", { name: "Add keypoints on the photo" }));
    cleanup();
    mountPlacing();
    const layer = await screen.findByTestId("gmic-place-layer");
    box(layer.parentElement!, 200, 100);
    fireEvent.pointerDown(layer, { pointerId: 1, clientX: 100, clientY: 50 });
    fireEvent.pointerMove(layer, { pointerId: 1, clientX: 120, clientY: 50 });
    fireEvent.pointerUp(layer, { pointerId: 1 });
    expect(bag("w").data!.points).toEqual([[60, 50, 50, 50]]);
    fireEvent.doubleClick(screen.getByRole("slider", { name: "Warp [Interactive]: keypoint 1" }));
    expect(bag("w").data!.points).toEqual([]);
  });
});

describe("placing points", () => {
  const placeButton = () => screen.findByRole("button", { name: "Add keypoints on the photo" });

  it("holds a zoomable canvas tool, with the place cursor, while placing", async () => {
    start([WARP]);
    mount(lastPanel("gmic.f.w").component);
    fireEvent.click(await placeButton());
    cleanup();
    const tool = mountPlacing();
    expect(tool.zoomable).toBe(true);
    expect((await screen.findByTestId("gmic-place-layer")).style.cursor).toBe("crosshair");
  });

  it("lets go of placing on Escape through the tool, with no key listener of its own", async () => {
    const added = vi.spyOn(window, "addEventListener");
    start([WARP]);
    mount(lastPanel("gmic.f.w").component);
    fireEvent.click(await placeButton());
    expect(added.mock.calls.filter(([type]) => type === "keydown")).toEqual([]);
    added.mockRestore();
    mount(rig.slots[0].component);
    act(() => rig.canvasTool()!.onEscape!());
    expect(screen.getByRole("button", { name: "Add keypoints on the photo" }).getAttribute("aria-pressed")).toBe("false");
    expect(rig.canvasTool()).toBeNull();
  });

  it("Done lets go of the tool", async () => {
    start([WARP]);
    mount(lastPanel("gmic.f.w").component);
    mount(rig.slots[0].component);
    fireEvent.click(await placeButton());
    expect(rig.canvasTool()).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(rig.canvasTool()).toBeNull();
  });

  it("stops placing when another extension takes the canvas", async () => {
    start([WARP]);
    mount(lastPanel("gmic.f.w").component);
    mount(rig.slots[0].component);
    fireEvent.click(await placeButton());
    act(() => rig.releaseCanvasTool());
    expect(screen.getByRole("button", { name: "Add keypoints on the photo" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("draws the handle with the move cursor", async () => {
    start([WARP]);
    rig.develop.setState({ paramBag: { "gmic.f.w": { on: true, values: {}, data: { points: [[60, 50, 50, 50]] } } } });
    mount(lastPanel("gmic.f.w").component);
    fireEvent.pointerDown(await placeButton());
    cleanup();
    mount(rig.slots[0].component);
    expect((await screen.findByRole("slider", { name: "Warp [Interactive]: keypoint 1" })).style.cursor).toBe("move");
  });
});

describe("undo steps", () => {
  it("a bare click on a point adds none", async () => {
    start([WARP]);
    rig.develop.setState({ paramBag: { "gmic.f.w": { on: true, values: {}, data: { points: [[60, 50, 50, 50]] } } } });
    mount(lastPanel("gmic.f.w").component);
    fireEvent.pointerDown(await screen.findByRole("button", { name: "Add keypoints on the photo" }));
    cleanup();
    mount(rig.slots[0].component);
    const handle = await screen.findByRole("slider", { name: "Warp [Interactive]: keypoint 1" });
    box(handle.parentElement!, 200, 100);
    handle.setPointerCapture = () => {};
    fireEvent.pointerDown(handle, { pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(rig.commits).toEqual([]);
  });
});
