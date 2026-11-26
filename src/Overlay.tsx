// The Develop canvas side of G'MIC: drives the live preview (what the view
// shows, through G'MIC, drawn by the view-only stage), shows a bar along the
// photo's top while G'MIC works on it, and draws the point settings of the
// panel touched last as handles to drag, as G'MIC-Qt's preview does. Only the
// handles take the pointer.

import { React, api } from "./rt";
import type { CommandDeps } from "./command";
import { gmicVars } from "./gmic/script";
import { stepJobs, stepParams, stepValues } from "./jobs";
import { PreviewController, textureEdge, type Area, type PreviewIO } from "./preview";
import { PREVIEW_SIZE_KEY, previewEdge } from "./Prefs";
import { MODE_OFF, qualified, texture } from "./stage";
import { STAGE_ID, itemKey, photoSteps, readState, statePatch, withData, withValue, type Item } from "./stack";
import { editorFor } from "./interactive";
import { handleStyle, percentAt } from "./interactive/handles";
import { ensureCatalogue, shared, useInstalled, useShared } from "./state";
import type { CanvasTool, DevelopOverlayState, DevelopParams, OverlayRect } from "./safelight";

const SPACE = { encoding: "perceptual", primaries: "rec709" } as const;

/** The part of the frame the view shows, from the canvas's own rectangles. */
export function shownArea(rect: OverlayRect, image: OverlayRect): Area {
  return [(rect.x - image.x) / image.w, (rect.y - image.y) / image.h, rect.w / image.w, rect.h / image.h];
}

/** The photo and what frames it: a result made for another can't be drawn. */
function frameKey(photoId: string, params: DevelopParams): string {
  return JSON.stringify([photoId, params.crop, params.straighten, params.transform, params.uprightMode, params.guidedLines]);
}

/** Whether a panel other than G'MIC's own is held off. */
const otherHeld = (bypassed: Readonly<Record<string, boolean>>) =>
  Object.entries(bypassed).some(([id, on]) => on && !id.startsWith(`${STAGE_ID}.f.`));

function upstreamKey(photoId: string, params: unknown, bag: Readonly<Record<string, unknown>>): string {
  const others = Object.keys(bag)
    .filter((k) => !k.startsWith(`${STAGE_ID}.`))
    .sort()
    .map((k) => [k, bag[k]]);
  return JSON.stringify([photoId, params, others]);
}

function usePreview(deps: CommandDeps, overlay: DevelopOverlayState) {
  const latest = React.useRef(overlay);
  latest.current = overlay;
  const controller = React.useRef<PreviewController | null>(null);

  React.useEffect(() => {
    let version = 0;
    const io: PreviewIO = {
      delay: 120,
      async capture(maxEdge) {
        const { rect, imageRect } = latest.current;
        if (!rect || !imageRect) return null;
        const params = api.stores.useDevelopStore.getState().params;
        const frame = await api.develop.captureFloatFrame(params, { point: "pre-output", space: SPACE, maxEdge });
        return frame ? { rgba: frame.data, width: frame.width, height: frame.height, area: shownArea(rect, imageRect) } : null;
      },
      run(input, stack, map) {
        const jobs = stepJobs(stack, shared().getState().catalogue, map);
        return deps.engine.runStack(input, jobs, { vars: gmicVars(input.width, input.height, true) });
      },
      upload(variant, result, basis) {
        version++;
        api.setStageTexture(STAGE_ID, "gmicOut", texture(result.rgba, result.width, result.height, version), variant);
        api.setStageTexture(STAGE_ID, "gmicIn", texture(basis.rgba, basis.width, basis.height, version), variant);
      },
      forget(variant) {
        api.setStageTexture(STAGE_ID, "gmicOut", null, variant);
        api.setStageTexture(STAGE_ID, "gmicIn", null, variant);
      },
      view(mode, area, place, variant) {
        api.develop.setViewValues(
          mode === MODE_OFF
            ? null
            : {
                [qualified("mode")]: mode,
                [qualified("area")]: [...area],
                [qualified("place")]: [...place],
                [qualified("gmicOut")]: variant,
                [qualified("gmicIn")]: variant,
              },
        );
      },
      status: (status) => shared().setState({ status }),
    };
    const c = new PreviewController(io);
    controller.current = c;
    return () => {
      c.dispose();
      controller.current = null;
      api.develop.setViewValues(null);
    };
  }, [deps]);

  const items = useInstalled();
  const photoId = api.stores.useDevelopStore((s) => s.photoId);
  const params = api.stores.useDevelopStore((s) => s.params);
  const bag = api.stores.useDevelopStore((s) => s.paramBag);
  const bypassed = api.stores.useDevelopStore((s) => s.bypassedPanels);
  const catalogue = useShared((s) => s.catalogue);
  const [size, setSize] = React.useState(() => api.settings.get<unknown>(PREVIEW_SIZE_KEY, "screen"));
  React.useEffect(() => api.settings.onChange((key, value) => key === PREVIEW_SIZE_KEY && setSize(value)), []);
  const { rect, imageRect, nonce } = overlay;

  React.useEffect(() => {
    const c = controller.current;
    if (!c) return;
    const steps = photoSteps(items, bag, (id) => bypassed[itemKey(id)] === true);
    if (!photoId || !rect || !imageRect || steps.length === 0) return c.update(null);
    if (!catalogue && steps.some((s) => s.kind === "filter")) {
      ensureCatalogue();
      return c.update(null);
    }
    const shown = Math.max(rect.w, rect.h) * (window.devicePixelRatio || 1);
    c.update({
      stack: steps,
      frame: frameKey(photoId, params),
      upstream: upstreamKey(photoId, params, bag),
      held: otherHeld(bypassed),
      area: shownArea(rect, imageRect),
      maxEdge: Math.min(previewEdge(api.settings, shown), textureEdge(rect.w / rect.h)),
    });
  }, [deps, items, photoId, params, bag, bypassed, catalogue, rect, imageRect, nonce, size]);
}

const AROUND_PHOTO = [-200, 300] as const;

function Handles(props: { item: Item; image: OverlayRect }) {
  const root = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState<string | null>(null);
  const stored = api.stores.useDevelopStore((s) => s.paramBag[itemKey(props.item.id)]);
  const catalogue = useShared((s) => s.catalogue);
  const state = readState({ [itemKey(props.item.id)]: stored }, props.item.id);
  const params = stepParams(props.item, catalogue);
  const values = stepValues(params, state?.values ?? {});
  const points = params.filter((p) => p.kind === "point");
  if (!state?.on || points.length === 0) return null;

  const percent = (e: React.PointerEvent): [number, number] | null => {
    const el = root.current;
    if (!el) return null;
    return percentAt(el, e, props.image, AROUND_PHOTO);
  };
  const set = (name: string, e: React.PointerEvent) => {
    const at = percent(e);
    if (!at) return;
    const now = readState(api.stores.useDevelopStore.getState().paramBag, props.item.id);
    api.stores.useDevelopStore.getState().setDynParams(statePatch(props.item.id, withValue(now, name, at)));
  };

  return (
    <div ref={root} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {points.map((p) => {
        if (p.kind !== "point") return null;
        const [x, y] = values[p.name] as number[];
        return (
          <div
            key={p.name}
            role="slider"
            aria-label={`${props.item.name}: ${p.name}`}
            aria-valuetext={`${Math.round(x)} %, ${Math.round(y)} %`}
            title={p.name}
            style={{ ...handleStyle(14), background: "rgba(255,255,255,0.15)", left: props.image.x + (x / 100) * props.image.w, top: props.image.y + (y / 100) * props.image.h }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              setDragging(p.name);
            }}
            onPointerMove={(e) => dragging === p.name && set(p.name, e)}
            onPointerUp={(e) => {
              if (dragging !== p.name) return;
              set(p.name, e);
              setDragging(null);
              void api.stores.useDevelopStore.getState().commitEdit(`G'MIC: ${props.item.name}: ${p.name.toLowerCase()}`);
            }}
            onPointerCancel={() => setDragging(null)}
          />
        );
      })}
    </div>
  );
}

export function GmicOverlay(props: { deps: CommandDeps }) {
  const overlay = api.develop.useDevelopOverlay();
  usePreview(props.deps, overlay);
  const focus = useShared((s) => s.focus);
  const items = useInstalled();
  const item = items.find((i) => i.id === focus);
  const placing = usePlacingTool();
  return (
    <>
      {overlay.rect && <Working shown={overlay.rect} />}
      {item && overlay.imageRect && !placing && <CanvasEditor item={item} image={overlay.imageRect} />}
    </>
  );
}

/** The photo, held as a canvas tool while points are placed on it: Escape,
 *  zoom and pan are the canvas's own. Whoever else takes the canvas ends it. */
const PLACING_TOOL: CanvasTool = {
  overlay: PlacingOverlay,
  zoomable: true,
  onEscape: () => shared().setState({ placing: null }),
};

function usePlacingTool(): boolean {
  const placing = useShared((s) => s.placing !== null);
  const held = api.develop.useCanvasToolHeld();
  const armed = React.useRef(false);
  React.useEffect(() => {
    if (!held && armed.current) shared().setState({ placing: null });
  }, [held]);
  React.useEffect(() => {
    if (!placing) return;
    api.develop.setCanvasTool(PLACING_TOOL);
    armed.current = true;
    return () => {
      armed.current = false;
      api.develop.setCanvasTool(null);
    };
  }, [placing]);
  return placing;
}

function PlacingOverlay() {
  const overlay = api.develop.useDevelopOverlay();
  const id = useShared((s) => s.placing);
  const item = useInstalled().find((i) => i.id === id);
  return item && overlay.imageRect ? <CanvasEditor item={item} image={overlay.imageRect} /> : null;
}

/** While G'MIC works on the preview: the thin bar along the top of the photo
 *  in view that Develop shows for its own waits, and G'MIC's name under it. */
function Working(props: { shown: OverlayRect }) {
  const busy = useShared((s) => s.status.busy);
  const visible = api.ui.useDelayedFlag(busy, 250);
  if (!visible) return null;
  const { x, y, w } = props.shown;
  const { tokens } = api.ui;
  return (
    <>
      <div
        role="progressbar"
        aria-label="G'MIC is working on the preview"
        className="sl-enter-fade"
        style={{ position: "absolute", left: x, top: y, width: w, height: 2, overflow: "hidden", pointerEvents: "none" }}
      >
        <div className="sl-indeterminate" style={{ position: "absolute", top: 0, bottom: 0, width: "33.333%", background: tokens.sliderFill }} />
      </div>
      <div
        aria-hidden
        className="sl-enter-fade"
        style={{
          position: "absolute",
          left: x + w - 8,
          top: y + 8,
          transform: "translateX(-100%)",
          padding: "2px 8px",
          borderRadius: 4,
          background: tokens.surface2,
          color: tokens.textMuted,
          fontSize: 11,
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        <api.ui.LoadingDots label="G'MIC" />
      </div>
    </>
  );
}

/** The touched item's points on the photo: an interactive filter's own
 *  editor, else handles for its point settings. */
function CanvasEditor(props: { item: Item; image: OverlayRect }) {
  const { item, image } = props;
  const stored = api.stores.useDevelopStore((s) => s.paramBag[itemKey(item.id)]);
  const catalogue = useShared((s) => s.catalogue);
  const filter = item.kind === "filter" ? catalogue?.categories.flatMap((c) => c.filters).find((f) => f.command === item.command) : undefined;
  const editor = filter?.interactive ? editorFor(filter.command) : undefined;
  const placing = useShared((st) => st.placing === item.id);
  if (!editor?.Canvas || !filter) return <Handles item={item} image={image} />;
  const state = readState({ [itemKey(item.id)]: stored }, item.id);
  if (!state?.on && !placing) return null;
  const Canvas = editor.Canvas;
  return (
    <Canvas
      id={item.id}
      name={item.name}
      filter={filter}
      values={stepValues(filter.params, state?.values ?? {})}
      data={state?.data}
      image={image}
      setData={(data) => {
        const now = readState(api.stores.useDevelopStore.getState().paramBag, item.id);
        api.stores.useDevelopStore.getState().setDynParams(statePatch(item.id, withData(now, data)));
      }}
      commit={(label) => void api.stores.useDevelopStore.getState().commitEdit(`G'MIC: ${label}`)}
    />
  );
}
