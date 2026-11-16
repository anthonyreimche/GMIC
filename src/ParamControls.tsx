// A filter's or script's parameters as controls.

import { React, api } from "./rt";
import type { Param, ParamValue, ParamValues } from "./gmic/params";

const hex = (rgb: number[]) =>
  `#${rgb
    .slice(0, 3)
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")}`;

function parseHex(text: string): number[] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(text.trim());
  return m ? m[1].match(/../g)!.map((h) => parseInt(h, 16)) : null;
}

function ColourControl(props: { name: string; value: number[]; onChange(v: number[]): void }) {
  const ui = api.ui;
  const [text, setText] = React.useState(hex(props.value));
  React.useEffect(() => setText(hex(props.value)), [props.value]);
  const alpha = props.value.length > 3 ? props.value[3] : null;
  return (
    <ui.Field label={props.name}>
      <ui.Row gap={6}>
        <ui.TextInput
          value={text}
          aria-label={props.name}
          onChange={(t) => {
            setText(t);
            const rgb = parseHex(t);
            if (rgb) props.onChange(alpha === null ? rgb : [...rgb, alpha]);
          }}
        />
        {alpha !== null && (
          <ui.NumberInput
            value={alpha}
            min={0}
            max={255}
            width="4.5em"
            aria-label={`${props.name} opacity`}
            onChange={(a) => props.onChange([...props.value.slice(0, 3), Math.max(0, Math.min(255, a))])}
          />
        )}
      </ui.Row>
    </ui.Field>
  );
}

const noteStyle = { margin: 0, fontSize: 11, opacity: 0.7, whiteSpace: "pre-wrap" } as const;

export function ParamControls(props: { params: readonly Param[]; values: ParamValues; onChange(name: string, value: ParamValue): void }) {
  const ui = api.ui;
  const { Slider } = api.components;
  return (
    <ui.Stack gap={6}>
      {props.params.map((p, i) => {
        switch (p.kind) {
          case "float":
          case "int": {
            const value = Number(props.values[p.name] ?? p.default);
            const step = p.kind === "int" ? 1 : Math.max((p.max - p.min) / 200, 0.0001);
            return (
              <Slider
                key={i}
                label={p.name}
                value={value}
                min={p.min}
                max={p.max}
                step={step}
                defaultValue={p.default}
                onChange={(v) => props.onChange(p.name, p.kind === "int" ? Math.round(v) : v)}
              />
            );
          }
          case "bool":
            return (
              <ui.Toggle key={i} label={p.name} checked={props.values[p.name] === true} onChange={(v) => props.onChange(p.name, v)} />
            );
          case "choice":
            return (
              <ui.Field key={i} label={p.name}>
                <ui.Select
                  ariaLabel={p.name}
                  value={String(props.values[p.name] ?? p.default)}
                  options={p.choices.map((label, n) => ({ value: String(n), label }))}
                  onChange={(v) => props.onChange(p.name, Number(v))}
                />
              </ui.Field>
            );
          case "color": {
            const value = props.values[p.name];
            return (
              <ColourControl key={i} name={p.name} value={Array.isArray(value) ? value : p.default} onChange={(v) => props.onChange(p.name, v)} />
            );
          }
          case "point": {
            const value = props.values[p.name];
            const [x, y] = Array.isArray(value) ? value : p.default;
            return (
              <ui.Field key={i} label={`${p.name} (%)`}>
                <ui.Row gap={6}>
                  <ui.NumberInput value={x} width="5em" aria-label={`${p.name} x`} onChange={(v) => props.onChange(p.name, [v, y])} />
                  <ui.NumberInput value={y} width="5em" aria-label={`${p.name} y`} onChange={(v) => props.onChange(p.name, [x, v])} />
                </ui.Row>
              </ui.Field>
            );
          }
          case "text":
            return (
              <ui.Field key={i} label={p.name}>
                <ui.TextInput aria-label={p.name} value={String(props.values[p.name] ?? p.default)} onChange={(v) => props.onChange(p.name, v)} />
              </ui.Field>
            );
          case "note":
            return p.text ? (
              <p key={i} style={noteStyle}>
                {p.text}
              </p>
            ) : null;
          case "separator":
            return <div key={i} style={{ height: 4 }} />;
          case "fixed":
          case "link":
            return null;
        }
      })}
    </ui.Stack>
  );
}
