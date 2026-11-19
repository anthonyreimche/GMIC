// Points drawn on the photo for Warp (keypoints: press on what to move, drag
// it where it goes) and Colorize (colour points). In the panel, a switch to
// place them and the list; over the photo, the points as handles, and while
// placing, a layer that takes presses. Double-click a point to remove it.

import { React, api } from "../rt";
import { shared, useShared } from "../state";
import type { CanvasEditorProps, EditorProps } from "./editors";
import { COLOUR_SIZE, WARP_SIZE, readPoints } from "./models";

export type PointsKind = "warp" | "colour";

const SIZE: Record<PointsKind, number> = { warp: WARP_SIZE, colour: COLOUR_SIZE };
const muted = { margin: 0, fontSize: 11, opacity: 0.7 } as const;
const clampPercent = (v: number) => Math.min(100, Math.max(0, v));

const hex = (rgb: readonly number[]) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
const parseHex = (text: string): number[] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(text.trim());
  return m ? m[1].match(/../g)!.map((h) => parseInt(h, 16)) : null;
};

function usePlacing(id: string): [boolean, (on: boolean) => void] {
  const placing = useShared((s) => s.placing === id);
  const set = React.useCallback((on: boolean) => shared().setState(on ? { placing: id, focus: id } : { placing: null }), [id]);
  React.useEffect(() => {
    if (!placing) return;
    const stop = (e: KeyboardEvent) => e.key === "Escape" && set(false);
    window.addEventListener("keydown", stop);
    return () => window.removeEventListener("keydown", stop);
  }, [placing, set]);
  return [placing, set];
}

function ColourField(props: { label: string; value: readonly number[]; onChange(rgb: number[]): void; onCommit(): void }) {
  const ui = api.ui;
  const [text, setText] = React.useState(hex(props.value));
  React.useEffect(() => setText(hex(props.value)), [props.value]);
  return (
    <ui.Row gap={6}>
      <span aria-hidden style={{ width: 16, height: 16, borderRadius: 3, background: hex(props.value), flex: "none", boxShadow: "0 0 0 1px rgba(127,127,127,0.5)" }} />
      <ui.TextInput
        aria-label={props.label}
        value={text}
        onBlur={props.onCommit}
        onChange={(t) => {
          setText(t);
          const rgb = parseHex(t);
          if (rgb) props.onChange(rgb);
        }}
      />
    </ui.Row>
  );
}

export function pointsPanel(kind: PointsKind) {
  return function PointsPanel(props: EditorProps & { id: string }) {
    const ui = api.ui;
    const [placing, setPlacing] = usePlacing(props.id);
    const brush = useShared((s) => s.brush);
    const points = readPoints(props.data, SIZE[kind]);
    const write = (next: number[][]) => props.setData({ points: next });
    const noun = kind === "warp" ? "keypoints" : "colours";
    return (
      <ui.Stack gap={6}>
        <ui.Row gap={6} wrap>
          <ui.Button size="sm" active={placing} aria-pressed={placing} onClick={() => setPlacing(!placing)}>
            {placing ? "Done" : kind === "warp" ? "Add keypoints on the photo" : "Place colours on the photo"}
          </ui.Button>
          {points.length > 0 && (
            <ui.Button
              size="sm"
              variant="ghost"
              onClick={() => {
                write([]);
                props.commit(`${props.name}: ${noun} cleared`);
              }}
            >
              Clear
            </ui.Button>
          )}
        </ui.Row>
        <p style={muted}>
          {kind === "warp"
            ? "Press on what to move and drag it where it goes. Drag a keypoint to change it; double-click it to remove it."
            : "Press on the photo to place the colour below there; drag a point to move it, double-click it to remove it."}
          {placing && " Esc when done."}
        </p>
        {kind === "colour" && (
          <ui.Field label="Colour to place">
            <ColourField label="Colour to place" value={brush} onChange={(rgb) => shared().setState({ brush: rgb })} onCommit={() => {}} />
          </ui.Field>
        )}
        {kind === "colour" &&
          points.map((p, i) => (
            <ui.Row key={i} gap={6}>
              <ColourField
                label={`Colour ${i + 1}`}
                value={p.slice(2)}
                onChange={(rgb) => write(points.map((q, j) => (j === i ? [q[0], q[1], ...rgb] : q)))}
                onCommit={() => props.commit(`${props.name}: colour`)}
              />
              <ui.Button
                size="sm"
                variant="ghost"
                aria-label={`Remove colour ${i + 1}`}
                onClick={() => {
                  write(points.filter((_, j) => j !== i));
                  props.commit(`${props.name}: colour removed`);
                }}
              >
                ×
              </ui.Button>
            </ui.Row>
          ))}
        {kind === "warp" && <p style={muted}>{points.length === 1 ? "1 keypoint" : `${points.length} keypoints`}</p>}
      </ui.Stack>
    );
  };
}

const handle = {
  position: "absolute",
  width: 12,
  height: 12,
  marginLeft: -6,
  marginTop: -6,
  borderRadius: "50%",
  border: "2px solid white",
  boxShadow: "0 0 0 1px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5)",
  pointerEvents: "auto",
  touchAction: "none",
  cursor: "move",
} as const;

export function pointsCanvas(kind: PointsKind) {
  return function PointsCanvas(props: CanvasEditorProps & { id: string }) {
    const root = React.useRef<HTMLDivElement>(null);
    const [placing] = usePlacing(props.id);
    const brush = useShared((s) => s.brush);
    const [dragging, setDragging] = React.useState<number | null>(null);
    /** Whether the gesture changed anything, so a bare click adds no undo step. */
    const changed = React.useRef(false);
    const points = readPoints(props.data, SIZE[kind]);
    const { image } = props;
    const write = (next: number[][]) => props.setData({ points: next });
    const noun = kind === "warp" ? "keypoint" : "colour";

    /** A press's position in % of the frame, zoom-proof. */
    const percent = (e: React.PointerEvent | React.MouseEvent): [number, number] => {
      const el = root.current!;
      const r = el.getBoundingClientRect();
      const sx = r.width > 0 ? el.offsetWidth / r.width : 1;
      const sy = r.height > 0 ? el.offsetHeight / r.height : 1;
      return [clampPercent((((e.clientX - r.left) * sx - image.x) / image.w) * 100), clampPercent((((e.clientY - r.top) * sy - image.y) / image.h) * 100)];
    };
    const screen = (x: number, y: number) => ({ left: image.x + (x / 100) * image.w, top: image.y + (y / 100) * image.h });
    const moveTo = (i: number, at: [number, number]) => write(points.map((p, j) => (j === i ? [...at, ...p.slice(2)] : p)));
    const drag = {
      onPointerMove: (e: React.PointerEvent) => {
        if (dragging === null) return;
        changed.current = true;
        moveTo(dragging, percent(e));
      },
      onPointerUp: () => {
        if (dragging === null) return;
        setDragging(null);
        if (!changed.current) return;
        props.commit(`${props.name}: ${noun}`);
      },
      onPointerCancel: () => setDragging(null),
    };

    return (
      <div ref={root} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {placing && (
          <div
            data-testid="gmic-place-layer"
            style={{ position: "absolute", left: image.x, top: image.y, width: image.w, height: image.h, pointerEvents: "auto", cursor: "crosshair", touchAction: "none" }}
            onPointerDown={(e) => {
              const at = percent(e);
              e.currentTarget.setPointerCapture?.(e.pointerId);
              write([...points, kind === "warp" ? [...at, ...at] : [...at, ...brush]]);
              changed.current = true;
              setDragging(points.length);
            }}
            {...drag}
          />
        )}
        {kind === "warp" && (
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
            {points.map(([dx, dy, sx, sy], i) => {
              const a = screen(sx, sy);
              const b = screen(dx, dy);
              return <line key={i} x1={a.left} y1={a.top} x2={b.left} y2={b.top} stroke="white" strokeWidth={1.5} strokeDasharray="3 2" />;
            })}
          </svg>
        )}
        {points.map((p, i) => (
          <div
            key={i}
            role="slider"
            aria-label={`${props.name}: ${noun} ${i + 1}`}
            aria-valuetext={`${Math.round(p[0])} %, ${Math.round(p[1])} %`}
            style={{ ...handle, ...screen(p[0], p[1]), background: kind === "colour" ? hex(p.slice(2)) : "rgba(255,255,255,0.15)" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture?.(e.pointerId);
              changed.current = false;
              setDragging(i);
            }}
            onDoubleClick={() => {
              write(points.filter((_, j) => j !== i));
              props.commit(`${props.name}: ${noun} removed`);
            }}
            {...drag}
          />
        ))}
      </div>
    );
  };
}
