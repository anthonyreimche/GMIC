// A stand-in Safelight API for unit tests, over real React and zustand. It has
// only what this extension uses: reading any other member throws, naming it,
// so a test shows what to add here when the extension starts using more.
// The UI kit is plain HTML with the same props, so tests find controls by role.

import * as React from "react";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type {
  CatalogPhoto,
  CommandContribution,
  DevelopOverlayState,
  EditState,
  ExportProcessorContribution,
  FloatFrame,
  KeptProgram,
  PanelContribution,
  ProcessingStageContribution,
  ProgramRunOptions,
  ProgramRunResult,
  SafelightAPI,
  SettingsContribution,
  SlotContribution,
  StageTextureData,
  TopBarButtonContribution,
  WindowContribution,
} from "../../src/safelight";

type Props = Record<string, unknown> & { children?: React.ReactNode };
const h = React.createElement;

const ui = {
  Button: ({ variant: _v, size: _s, active: _a, full: _f, ...rest }: Props) => h("button", { type: "button", ...rest }),
  Select: (p: { value: string; onChange(v: string): void; options?: { value: string; label: string }[]; ariaLabel?: string }) =>
    h(
      "select",
      { value: p.value, "aria-label": p.ariaLabel, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => p.onChange(e.target.value) },
      (p.options ?? []).map((o) => h("option", { key: o.value, value: o.value }, o.label)),
    ),
  TextInput: ({ value, onChange, ...rest }: Props & { value: string; onChange(v: string): void }) =>
    h("input", { ...rest, value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value) }),
  NumberInput: ({ value, onChange, width: _w, ...rest }: Props & { value: number; onChange(v: number): void }) =>
    h("input", { ...rest, type: "number", value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value)) }),
  TextArea: ({ value, onChange, mono: _m, ...rest }: Props & { value: string; onChange(v: string): void }) =>
    h("textarea", { ...rest, value, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value) }),
  Toggle: (p: { checked: boolean; onChange(v: boolean): void; label?: React.ReactNode }) =>
    h("label", null, h("input", { type: "checkbox", checked: p.checked, onChange: (e: React.ChangeEvent<HTMLInputElement>) => p.onChange(e.target.checked) }), p.label),
  SegmentedControl: (p: { value: string; onChange(v: string): void; options: { value: string; label: React.ReactNode }[] }) =>
    h(
      "div",
      { role: "tablist" },
      p.options.map((o) => h("button", { key: o.value, role: "tab", "aria-selected": o.value === p.value, onClick: () => p.onChange(o.value) }, o.label)),
    ),
  Field: (p: { label?: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }) => h("div", null, p.label, p.children, p.hint),
  Section: (p: { title: React.ReactNode; children: React.ReactNode }) => h("section", null, h("h3", null, p.title), p.children),
  Stack: (p: { children: React.ReactNode }) => h("div", null, p.children),
  Row: (p: { children: React.ReactNode }) => h("div", null, p.children),
  ProgressBar: (p: { label?: string }) => h("div", { role: "progressbar", "aria-label": p.label }, p.label),
  LoadingDots: (p: { label?: string }) => h("span", null, p.label),
  useDelayedFlag: (active: boolean) => active,
  tokens: { sliderFill: "var(--color-slider-fill)", surface2: "var(--color-surface-2)", textMuted: "var(--color-text-muted)" },
};

/** A range input; letting go of it (pointer up) is the slider's commit. */
function Slider(p: { label: string; value: number; onChange(v: number): void; onCommit?(): void; min?: number; max?: number; step?: number }) {
  return h("input", {
    type: "range",
    "aria-label": p.label,
    value: p.value,
    min: p.min,
    max: p.max,
    step: p.step,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => p.onChange(Number(e.target.value)),
    onPointerUp: () => p.onCommit?.(),
  });
}

export interface DevelopFake {
  photoId: string | null;
  params: Record<string, unknown>;
  paramBag: Record<string, unknown>;
  bypassedPanels: Record<string, boolean>;
  setDynParams(patch: Record<string, unknown>): void;
  commitEdit(label: string): Promise<void>;
}

export interface ProgramCall {
  token: string;
  args: string[];
  options: ProgramRunOptions;
}

export interface Rig {
  api: SafelightAPI;
  /** Every registerPanel call, in order (a re-registration appends). */
  panels: PanelContribution[];
  unregistered: string[];
  /** Panels toggled open or closed, by id. */
  toggled: string[];
  open: Set<string>;
  stages: ProcessingStageContribution[];
  processors: ExportProcessorContribution[];
  settingsSections: SettingsContribution[];
  buttons: TopBarButtonContribution[];
  windows: WindowContribution[];
  /** The extension window open now, and every open/close/toggle asked. */
  openWindow: string | null;
  windowCalls: string[];
  slots: SlotContribution[];
  textures: { stage: string; key: string; tex: StageTextureData | null; variant?: string }[];
  viewValues: (Record<string, unknown> | null)[];
  commits: string[];
  captures: number[];
  overlay: DevelopOverlayState;
  editStates: Map<string, EditState>;
  develop: UseBoundStore<StoreApi<DevelopFake>>;
  commands: CommandContribution[];
  settings: Map<string, unknown>;
  kept: KeptProgram[];
  calls: ProgramCall[];
  /** What the next program runs answer, by call. */
  answer: (call: ProgramCall) => Partial<ProgramRunResult> | Promise<Partial<ProgramRunResult>>;
  renders: { photo: string; settings: Record<string, unknown> }[];
  saved: { photo: string; suffix: string; ext: string; type: string }[];
  located: string[];
  /** What gmic.eu's download page reads, or null when it can't be reached. */
  downloadPage: string | null;
  fetched: string[];
  openPhoto(photo: CatalogPhoto | null): void;
}

export const PHOTO = { id: "p1", filename: "IMG_1.CR3", copyName: null } as unknown as CatalogPhoto;

/** A 16-bit PNG header, enough for the bit-depth check. */
export function png16(): Uint8Array {
  const b = new Uint8Array(33);
  b.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82], 0);
  b[24] = 16;
  return b;
}

export function fakeApi(): Rig {
  const settings = new Map<string, unknown>();
  const listeners = new Set<(key: string, value: unknown) => void>();
  const commits: string[] = [];
  const develop = create<DevelopFake>()((set) => ({
    photoId: PHOTO.id,
    params: { exposure: 0 },
    paramBag: {},
    bypassedPanels: {},
    setDynParams: (patch) => set((st) => ({ paramBag: { ...st.paramBag, ...patch } })),
    commitEdit: async (label) => void commits.push(label),
  }));
  const catalogStore = create<{ photos: CatalogPhoto[] }>()(() => ({ photos: [PHOTO] }));

  const rig: Rig = {
    api: undefined as unknown as SafelightAPI,
    panels: [],
    unregistered: [],
    toggled: [],
    open: new Set(),
    stages: [],
    processors: [],
    settingsSections: [],
    buttons: [],
    windows: [],
    openWindow: null,
    windowCalls: [],
    slots: [],
    textures: [],
    viewValues: [],
    commits,
    captures: [],
    overlay: {
      rect: { x: 0, y: 0, w: 200, h: 100 },
      imageRect: { x: 0, y: 0, w: 200, h: 100 },
      nonce: 1,
      toScreen: null,
      toImage: null,
      radiusToScreen: null,
      radiusToImage: null,
      region: null,
      imageAspect: 2,
    },
    editStates: new Map(),
    develop,
    commands: [],
    settings,
    kept: [],
    calls: [],
    answer: () => ({}),
    renders: [],
    saved: [],
    located: [],
    downloadPage: null,
    fetched: [],
    openPhoto: (photo) => develop.setState({ photoId: photo?.id ?? null }),
  };

  const members = {
    version: 1,
    extensionId: "gmic",
    react: React,
    registerPanel: (c: PanelContribution) => void rig.panels.push(c),
    unregisterPanel: (id: string) => void rig.unregistered.push(id),
    registerProcessingStage: (c: ProcessingStageContribution) => void rig.stages.push(c),
    registerExportProcessor: (c: ExportProcessorContribution) => void rig.processors.push(c),
    registerSettings: (c: SettingsContribution) => void rig.settingsSections.push(c),
    registerTopBarButton: (c: TopBarButtonContribution) => void rig.buttons.push(c),
    registerWindow: (c: WindowContribution) => void rig.windows.push(c),
    windows: {
      open: (id: string) => {
        rig.windowCalls.push(`open ${id}`);
        rig.openWindow = id;
      },
      close: (id: string) => {
        rig.windowCalls.push(`close ${id}`);
        if (rig.openWindow === id) rig.openWindow = null;
      },
      toggle: (id: string) => {
        rig.windowCalls.push(`toggle ${id}`);
        rig.openWindow = rig.openWindow === id ? null : id;
      },
      isOpen: (id: string) => rig.openWindow === id,
    },
    registerSlot: (c: SlotContribution) => void rig.slots.push(c),
    setStageTexture: (stage: string, key: string, tex: StageTextureData | null, variant?: string) => void rig.textures.push({ stage, key, tex, variant }),
    dock: {
      isPanelOpen: (id: string) => rig.open.has(id),
      togglePanel: (id: string) => {
        rig.toggled.push(id);
        if (rig.open.has(id)) rig.open.delete(id);
        else rig.open.add(id);
      },
    },
    develop: {
      setViewValues: (v: Record<string, unknown> | null) => void rig.viewValues.push(v),
      useDevelopOverlay: () => rig.overlay,
      captureFloatFrame: async (_params: unknown, options: { maxEdge?: number }): Promise<FloatFrame> => {
        rig.captures.push(options.maxEdge ?? 0);
        return { data: new Float32Array(2 * 1 * 4).fill(0.5), width: 2, height: 1, space: { encoding: "perceptual", primaries: "rec709" }, point: "pre-output" };
      },
    },
    commands: {
      register: (c: CommandContribution) => void rig.commands.push(c),
      canSaveBeside: async () => null,
      saveBeside: async (photo: CatalogPhoto, data: Blob, suffix: string, ext: string) => {
        rig.saved.push({ photo: photo.id, suffix, ext, type: data.type });
        return `IMG_1-${suffix}.${ext}`;
      },
    },
    programs: {
      list: async () => [...rig.kept],
      locate: async (name: string) => {
        rig.located.push(name);
        const found = { token: "t1", path: "C:\\gmic\\gmic.exe", name: "gmic.exe" };
        rig.kept.push(found);
        return found;
      },
      pick: async () => null,
      forget: async (token: string) => {
        rig.kept = rig.kept.filter((k) => k.token !== token);
      },
      run: async (token: string, args: string[], options: ProgramRunOptions = {}): Promise<ProgramRunResult> => {
        const call = { token, args, options };
        rig.calls.push(call);
        return { exitCode: 0, killed: null, stdout: "", stderr: "", files: {}, ...(await rig.answer(call)) };
      },
    },
    settings: {
      get: <T,>(key: string, fallback: T): T => (settings.has(key) ? (settings.get(key) as T) : fallback),
      set: (key: string, value: unknown) => {
        settings.set(key, value);
        for (const l of listeners) l(key, value);
      },
      onChange: (cb: (key: string, value: unknown) => void) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
    },
    catalog: {
      photoDisplayName: (p: CatalogPhoto) => p.filename,
      getEditState: async (id: string) => rig.editStates.get(id) ?? null,
    },
    network: {
      fetch: async (url: string) => {
        rig.fetched.push(url);
        if (rig.downloadPage === null) throw new TypeError("Failed to fetch");
        return new Response(rig.downloadPage, { status: 200 });
      },
    },
    export: {
      renderPhotos: async (photos: CatalogPhoto[], s: Record<string, unknown>) => {
        rig.renders.push({ photo: photos[0].id, settings: s });
        return [{ photo: photos[0], blob: new Blob([new Uint8Array(png16())], { type: "image/png" }), width: 10, height: 10 }];
      },
    },
    stores: { useDevelopStore: develop, useCatalogStore: catalogStore, create },
    ui,
    components: { Slider },
  };
  rig.api = strict(members, "api") as unknown as SafelightAPI;
  return rig;
}

/** Wraps a plain object so reading a member it lacks throws, naming the member. */
function strict<T extends object>(target: T, path: string): T {
  return new Proxy(target, {
    get(obj, key, receiver) {
      if (typeof key === "symbol" || key === "then" || key === "toJSON") return Reflect.get(obj, key, receiver);
      if (!(key in obj)) throw new Error(`The fake API has no ${path}.${key}. Add it to test/support/fake-api.ts.`);
      const value: unknown = Reflect.get(obj, key, receiver);
      const isPlainObject = typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
      return isPlainObject && key !== "react" && key !== "ui" ? strict(value, `${path}.${key}`) : value;
    },
  });
}
