// The Curves filter's editor, in its panel: one curve per channel of the
// chosen colour space, drawn as G'MIC draws it. Press on the curve's box to
// add a point, drag a point to move it, double-click one to remove it.

import { React, api } from "../rt";
import type { EditorProps } from "./editors";
import { COLOR_SPACE, CURVE_CHANNELS, IDENTITY, addPoint, curveAt, movePoint, readCurves, removePoint, type Curve } from "./models";

const HIT = 4;
const box = { width: "100%", aspectRatio: "1", display: "block", touchAction: "none", cursor: "crosshair", borderRadius: 4 } as const;

function pathOf(curve: Curve): string {
  const steps: string[] = [];
  for (let x = 0; x <= 100; x += 0.5) steps.push(`${x === 0 ? "M" : "L"}${x},${100 - Math.min(100, Math.max(0, curveAt(curve, x)))}`);
  return steps.join(" ");
}

export function CurvesEditor(props: EditorProps) {
  const ui = api.ui;
  const svg = React.useRef<SVGSVGElement>(null);
  const [channel, setChannel] = React.useState(0);
  const [dragging, setDragging] = React.useState<number | null>(null);
  /** Whether the gesture changed anything, so a bare click adds no undo step. */
  const changed = React.useRef(false);
  const space = Math.min(8, Math.max(0, Math.round(Number(props.values[COLOR_SPACE] ?? 0)) || 0));
  const labels = CURVE_CHANNELS[space];
  const shown = Math.min(channel, labels.length - 1);
  const curves = readCurves(props.data);
  const curve = curves[shown];

  const write = (next: Curve) => props.setData({ curves: curves.map((c, i) => (i === shown ? next : c)) });
  const at = (e: React.PointerEvent): [number, number] => {
    const r = svg.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 100, 100 - ((e.clientY - r.top) / r.height) * 100];
  };
  const nearest = (x: number, y: number): number => {
    let best = -1;
    let dist = HIT;
    for (let i = 0; i < curve.length / 2; i++) {
      const d = Math.hypot(curve[i * 2] - x, curve[i * 2 + 1] - y);
      if (d < dist) [best, dist] = [i, d];
    }
    return best;
  };

  return (
    <ui.Stack gap={6}>
      <ui.SegmentedControl size="sm" value={String(shown)} onChange={(v) => setChannel(Number(v))} options={labels.map((label, i) => ({ value: String(i), label }))} />
      <svg
        ref={svg}
        role="img"
        aria-label={`${labels[shown]} curve`}
        viewBox="-2 -2 104 104"
        style={box}
        onPointerDown={(e) => {
          const [x, y] = at(e);
          let index = nearest(x, y);
          changed.current = index < 0;
          if (index < 0) {
            const added = addPoint(curve, x, y);
            if (added.index < 0) return;
            write(added.curve);
            index = added.index;
          }
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setDragging(index);
        }}
        onPointerMove={(e) => {
          if (dragging === null) return;
          const [x, y] = at(e);
          changed.current = true;
          write(movePoint(curve, dragging, x, y));
        }}
        onPointerUp={() => {
          if (dragging === null) return;
          setDragging(null);
          if (!changed.current) return;
          props.commit(`${props.name}: ${labels[shown].toLowerCase()} curve`);
        }}
        onDoubleClick={(e) => {
          const [x, y] = at(e as unknown as React.PointerEvent);
          const index = nearest(x, y);
          if (index <= 0) return;
          write(removePoint(curve, index));
          props.commit(`${props.name}: ${labels[shown].toLowerCase()} curve`);
        }}
      >
        <rect x={0} y={0} width={100} height={100} fill="currentColor" opacity={0.06} />
        {[25, 50, 75].map((v) => (
          <g key={v} stroke="currentColor" opacity={0.15} strokeWidth={0.3}>
            <line x1={v} y1={0} x2={v} y2={100} />
            <line x1={0} y1={v} x2={100} y2={v} />
          </g>
        ))}
        <line x1={0} y1={100} x2={100} y2={0} stroke="currentColor" opacity={0.25} strokeWidth={0.3} strokeDasharray="1.5 1.5" />
        <path d={pathOf(curve)} fill="none" stroke="currentColor" strokeWidth={0.8} />
        {Array.from({ length: curve.length / 2 }, (_, i) => (
          <circle key={i} cx={curve[i * 2]} cy={100 - curve[i * 2 + 1]} r={dragging === i ? 2.2 : 1.8} fill="currentColor" />
        ))}
      </svg>
      <ui.Row gap={6} justify="space-between">
        <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>Press to add a point, drag to move it, double-click to remove it.</p>
        <ui.Button
          size="sm"
          variant="ghost"
          onClick={() => {
            write([...IDENTITY]);
            props.commit(`${props.name}: ${labels[shown].toLowerCase()} curve reset`);
          }}
        >
          Reset curve
        </ui.Button>
      </ui.Row>
    </ui.Stack>
  );
}
